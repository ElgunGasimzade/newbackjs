const DealService = require('../services/DealService');

class BrandSelectionController {

    async getBrandDeals(req, res) {
        try {
            const { scanId } = req.query;
            let data;

            if (scanId) {
                // If we have a scanId, try to find the specific items user confirmed
                // We need to require ScanController here or pass it in.
                // Since node modules are cached, require returns the same instance.
                const ScanController = require('./ScanController');
                const scanItems = ScanController.getScanItems(scanId);

                if (scanItems && scanItems.length > 0) {
                    const queries = scanItems.map(i => i.name);
                    const matchingProducts = await DealService.searchProducts(queries);
                    // Group them
                    // Group them using the shared fuzzy logic
                    const DealMapper = require('../mappers/DealMapper');
                    const grouped = DealService.groupProducts(matchingProducts);

                    const responseGroups = Object.keys(grouped).map(k => DealMapper.mapToBrandGroup(k, grouped[k]));
                    data = { groups: responseGroups };

                } else {
                    // Fallback if scanId invalid or empty
                    data = await DealService.getGroupedBrandDeals();
                }
            } else {
                // No scanId, return all (or maybe empty? User said "show every product" was the bug)
                // Usually "Brands" tab might show "All Brands".
                data = await DealService.getGroupedBrandDeals();
            }

            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new BrandSelectionController();
