const DealService = require('../services/DealService');
const ScanController = require('./ScanController'); // Require to access shared state

// In-memory store for generated plans (acting as temporary cache for route details)
const planStore = new Map();

class PlanningController {

    async optimizePlan(req, res) {
        try {
            console.log("[Planning] Optimizing Route...");
            // Use filtered list that excludes Unknown/Generic
            const allProducts = await DealService.getAllProducts();

            const inputItemIds = req.body.ids || [];
            let inputItemNames = req.body.items || [];

            // Normalize helper
            const normalize = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

            // Build structured Shopping List
            let shoppingList = [];

            if (inputItemIds.length > 0) {
                console.log(`[Planning] Optimizing for ${inputItemIds.length} IDs.`);
                // Resolve specific items first
                const resolvedProducts = allProducts.filter(p => inputItemIds.includes(p.id));

                shoppingList = resolvedProducts.map(p => ({
                    id: p.id, // Preferred, exact ID
                    term: normalize(p.brandName === "Generic" ? (p.description || p.productName) : p.productName), // Fallback search term
                    originalName: p.description || p.productName
                }));
            } else {
                // Fallback / Names only flow
                if (inputItemNames.length === 0) {
                    const scanItems = ScanController.getLastScanItems();
                    if (scanItems && scanItems.length > 0) {
                        inputItemNames = scanItems.map(i => i.name);
                    } else {
                        inputItemNames = ["Yogurt", "Milk", "Eggs"];
                    }
                }
                shoppingList = inputItemNames.map(name => ({
                    id: null,
                    term: normalize(name),
                    originalName: name
                }));
            }

            console.log(`[Planning] Final Shopping List: ${shoppingList.map(i => i.term).join(', ')}`);

            // --- OPTION A: MAX SAVINGS (Global Best Deals) ---
            const maxSavingsStops = {};
            let maxSavingsTotalSavings = 0;

            shoppingList.forEach(reqItem => {
                // Find global matches
                // 1. If ID exists, find it directly? 
                //    actually max savings means "Best Deal for this ITEM Type".
                //    But if user selected a Specific Brand, they probably want THAT brand.

                let matches = [];

                // Strategy: Find candidates globally
                const escapedTerm = reqItem.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

                matches = allProducts.filter(p => {
                    // If we have a preferred ID, we could prioritize it, but Max Savings usually implies finding the best price for the *category*.
                    // However, to respect "Brand Selection", if I picked Ariel, I shouldn't get Bingo just because it's cheaper.
                    // So let's prioritize matches that share the same BRAND if an ID was provided.
                    const normName = normalize(p.productName || p.name);
                    const normDesc = normalize(p.description);
                    const normBrand = normalize(p.brandName);
                    return regex.test(normName) || regex.test(normDesc) || regex.test(normBrand);
                });

                if (reqItem.id) {
                    // Filter matches to strict brand/category if ID was given? 
                    // Or prioritize the exact item.
                    // Let's find the exact item first.
                    const exactItem = allProducts.find(p => p.id === reqItem.id);
                    if (exactItem) {
                        // If exact item is found, we might want to check if it's available cheaper elsewhere?
                        // But usually grouped deals are by Store. 
                        // The `allProducts` list contains 1 entry per product per store?
                        // Yes, the CSV has entries for each store.

                        // Wait, if ID=1 is "Ariel at TAMSTORE", ID=2 is "Ariel at BRAVO".
                        // If user sent ID=1, they clicked "Ariel at TAMSTORE". 
                        // Did they mean "I want Ariel" or "I want this specific row"?
                        // Usually Brand Selection shows "Ariel" generic card? No, looking at DealService it groups by Keyword.
                        // The Dealmapper assigns ID to each CSV row.

                        // If the user selected a specific Option in the Brand screen, they selected a specific Store+Price combo?
                        // Let's check BrandSelectionResponse.
                        // It returns Groups -> Options. Each Option has `store` and `price`.
                        // So yes, ID implies a specific Store.

                        // If user picked specific store items for ALL items, Option A is just "Go where you said".
                        // BUT usually Brand Selection lets you pick "Ariel" (and maybe it shows the best one?).
                        // If the UI sends the ID of the selected card, that card belongs to ONE store.

                        // PROPOSAL: If ID is sent, use that EXACT item for that line.
                        // If checking for "Max Savings", maybe look for SAME product at different stores?
                        // Our CSV structure: `product_name` + `brand` + `category` defines the product.

                        // Let's stick to: Find best price for the *Term/Category* but prioritize Brand if known.
                        // Simpler: Just find min price match for the Term.
                    }
                }

                if (matches.length > 0) {
                    // Sort by Price ASC (Prioritize Exact ID)
                    matches.sort((a, b) => {
                        if (reqItem.id) {
                            if (a.id == reqItem.id) return -1;
                            if (b.id == reqItem.id) return 1;
                        }
                        return a.newPrice - b.newPrice;
                    });
                    const bestDeal = matches[0];

                    if (!maxSavingsStops[bestDeal.store]) {
                        maxSavingsStops[bestDeal.store] = [];
                    }

                    const savings = (bestDeal.oldPrice - bestDeal.newPrice) > 0 ? (bestDeal.oldPrice - bestDeal.newPrice) : 0;

                    maxSavingsStops[bestDeal.store].push({
                        id: bestDeal.id,
                        name: bestDeal.description || bestDeal.productName,
                        price: bestDeal.newPrice,
                        savings: savings,
                        aisle: "General",
                        checked: false,
                        // Mark if this was exact choice
                        isExact: reqItem.id && bestDeal.id === reqItem.id
                    });

                    maxSavingsTotalSavings += savings;
                }
            });

            // Convert Option A Map
            const optionAStopSummaries = Object.keys(maxSavingsStops).map(storeName => ({
                store: storeName,
                summary: `${maxSavingsStops[storeName].length} item(s)`
            }));

            const optionADetails = {
                totalSavings: maxSavingsTotalSavings,
                estTime: `${Object.keys(maxSavingsStops).length * 15} mins`,
                stops: Object.keys(maxSavingsStops).map((storeName, index) => ({
                    sequence: index + 1,
                    store: storeName,
                    distance: `${(Math.random() * 2).toFixed(1)} km`,
                    color: index % 2 === 0 ? "green" : "blue",
                    items: maxSavingsStops[storeName]
                }))
            };
            planStore.set("opt_max_savings", optionADetails);


            // --- OPTION B: SINGLE STORE (Best Basket) ---
            const uniqueStores = [...new Set(allProducts.map(p => p.store))];
            let bestStore = null;
            let bestStoreBasketPrice = Infinity;
            let bestStoreSavings = 0;
            let bestStoreItems = [];
            let bestStoreFoundCount = 0;

            uniqueStores.forEach(store => {
                const storeProducts = allProducts.filter(p => p.store === store);

                let currentBasketPrice = 0;
                let currentSavings = 0;
                let foundItems = [];
                let itemsFoundCount = 0;

                shoppingList.forEach(reqItem => {
                    // 1. Try to find EXACT ID matches if preferred (e.g. if the user picked a specific item that exists at this store)
                    // Note: IDs in our system are currently unique per ROw (Store+Product). 
                    // So ID 1 is ONLY at Tamstore. It will never be at Bravo.
                    // So checking for ID match at current 'store' will only work if 'store' == ID's store.

                    // So for Option B (checking Store X), we need to find "Product EQUIVALENT to ID 1".
                    // Logic: Match by normalized term.

                    const escapedTerm = reqItem.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

                    const matches = storeProducts.filter(p => {
                        const normName = normalize(p.productName || p.name);
                        const normDesc = normalize(p.description);
                        const normBrand = normalize(p.brandName);
                        return regex.test(normName) || regex.test(normDesc) || regex.test(normBrand);
                    });

                    if (matches.length > 0) {
                        // Pick the best match at this store (Prioritize Exact ID)
                        matches.sort((a, b) => {
                            if (reqItem.id) {
                                if (a.id == reqItem.id) return -1;
                                if (b.id == reqItem.id) return 1;
                            }
                            return a.newPrice - b.newPrice;
                        });
                        const match = matches[0];

                        currentBasketPrice += match.newPrice;
                        const savings = (match.oldPrice - match.newPrice) > 0 ? (match.oldPrice - match.newPrice) : 0;
                        currentSavings += savings;

                        foundItems.push({
                            id: match.id,
                            name: match.description || match.productName,
                            price: match.newPrice,
                            savings: savings,
                            aisle: "General",
                            checked: false
                        });
                        itemsFoundCount++;
                    }
                });

                if (itemsFoundCount > 0) {
                    if (!bestStore || (itemsFoundCount > bestStoreFoundCount) || (itemsFoundCount === bestStoreFoundCount && currentBasketPrice < bestStoreBasketPrice)) {
                        bestStore = store;
                        bestStoreBasketPrice = currentBasketPrice;
                        bestStoreSavings = currentSavings;
                        bestStoreItems = foundItems;
                        bestStoreFoundCount = itemsFoundCount;
                    }
                }
            });

            const totalRequired = shoppingList.length;
            const availabilityText = (bestStoreFoundCount === totalRequired)
                ? `All ${totalRequired} items available here`
                : `${bestStoreFoundCount} of ${totalRequired} items available here`;

            const optionBStopSummaries = bestStore ? [{
                store: bestStore,
                summary: availabilityText
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

            res.json({
                options: [
                    {
                        id: "opt_max_savings",
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
