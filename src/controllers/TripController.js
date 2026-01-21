class TripController {
    constructor() {
        this.lastTrip = null;
    }

    async saveTrip(req, res) {
        try {
            const { totalSavings, timeSpent, dealsScouted } = req.body;
            this.lastTrip = {
                totalSavings: parseFloat(totalSavings || 0),
                timeSpent: timeSpent || "0 mins",
                dealsScouted: parseInt(dealsScouted || 0),
                timestamp: Date.now()
            };
            console.log("[Trip] Saved completed trip:", this.lastTrip);
            res.json({ success: true, tripId: `trip_${this.lastTrip.timestamp}` });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to save trip" });
        }
    }

    async getLastTrip(req, res) {
        // Return saved trip if available and fresh (e.g. within 5 mins? Optional constraint)
        // For now, just return it if it exists
        if (this.lastTrip) {
            res.json({
                totalSavings: this.lastTrip.totalSavings,
                timeSpent: this.lastTrip.timeSpent,
                lifetimeEarnings: parseFloat((120.50 + this.lastTrip.totalSavings).toFixed(2)), // Mock cumulative
                chartData: [0.3, 0.45, 0.6, 0.4, 0.75, 0.5, 0.9],
                dealsScouted: 1250 + this.lastTrip.dealsScouted,
                wagePerHour: 35.00,
                tripId: `trip_${this.lastTrip.timestamp}`
            });
            return;
        }

        const ScanController = require('./ScanController');
        const DealService = require('../services/DealService');

        const lastItems = ScanController.getLastScanItems();
        let calculatedSavings = 0;
        let dealsFound = 0;

        if (lastItems && lastItems.length > 0) {
            const allProducts = await DealService.getAllProducts();
            // Simple matching
            lastItems.forEach(item => {
                const match = allProducts.find(p => (p.productName || p.name).toLowerCase() === item.name.toLowerCase());
                if (match) {
                    const original = match.originalPrice || match.price;
                    const current = match.price;
                    if (current < original) {
                        calculatedSavings += (original - current);
                        dealsFound++;
                    }
                }
            });
        }

        res.json({
            totalSavings: parseFloat(calculatedSavings.toFixed(2)),
            timeSpent: lastItems && lastItems.length > 0 ? "12 mins" : "0 mins",
            lifetimeEarnings: parseFloat((0 + calculatedSavings).toFixed(2)), // Base 0, let client handle accumulation
            chartData: [0.3, 0.45, 0.25, 0.6, 0.4, 0.75, 0.5, 0.9],
            dealsScouted: 1240 + dealsFound,
            wagePerHour: 35.00,
            tripId: ScanController.getLastScanId() || `trip_${Date.now()}` // Unique ID for de-duplication
        });
    }
}

module.exports = new TripController();
