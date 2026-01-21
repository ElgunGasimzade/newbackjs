class ScanController {

    constructor() {
        this.scanStore = new Map();
    }

    async processScan(req, res) {
        const DealService = require('../services/DealService');
        // Get 3 random real products from the CSV
        const randomProducts = await DealService.getRandomDeals(3);

        const detectedHandler = randomProducts.map((p, index) => ({
            id: p.id || `detected_${Date.now()}_${index}`,
            name: p.productName || p.name || "Unknown Product",
            confidence: 0.8 + (Math.random() * 0.15), // Random confidence 0.80-0.95
            dealAvailable: !!p.discountPercentage,
            imageUrl: p.imageUrl || null
        }));

        res.json({
            scanId: "scan_" + Date.now(),
            detectedItems: detectedHandler
        });
    }

    async confirmScan(req, res) {
        const { scanId } = req.params;
        const items = req.body;

        // Store confirmed items for BrandSelection
        this.scanStore.set(scanId, items); // items is array of { name, ... }

        // Just echo back what was confirmed
        res.json({
            scanId: scanId,
            detectedItems: items || []
        });
    }

    getScanItems(scanId) {
        return this.scanStore.get(scanId);
    }

    getLastScanItems() {
        // Return entries from the last set key, or empty
        // Iterating map keys to find last insert (insertion order preserved in JS Map)
        if (this.scanStore.size === 0) return [];
        const keys = Array.from(this.scanStore.keys());
        const lastKey = keys[keys.length - 1];
        return this.scanStore.get(lastKey);
    }

    getLastScanId() {
        if (this.scanStore.size === 0) return null;
        const keys = Array.from(this.scanStore.keys());
        return keys[keys.length - 1];
    }
}

module.exports = new ScanController();
