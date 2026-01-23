const DealService = require('../services/DealService');

class BrandSelectionController {

    async getBrandDeals(req, res) {
        try {
            const { scanId } = req.query;
            let data;

            if (scanId) {
                // If we have a scanId, try to find the specific items user confirmed
                const ScanController = require('./ScanController');
                const scanItems = ScanController.getScanItems(scanId);

                if (scanItems && scanItems.length > 0) {
                    const groups = [];
                    const DealMapper = require('../mappers/DealMapper');

                    const lang = req.headers['accept-language']?.startsWith('az') ? 'az' : 'en';
                    // User Request: "categorized inside items that send in scan page"
                    // Iterate and create a group for EACH scanned item
                    for (const item of scanItems) {
                        const query = item.name;
                        // Search for this specific item
                        const matchingProducts = await DealService.searchProducts([query]);

                        // Create a group for this item
                        if (matchingProducts.length > 0) {
                            groups.push(DealMapper.mapToBrandGroup(query, matchingProducts, lang));
                        }
                    }

                    data = { groups: groups };

                } else {
                    // Fallback if scanId invalid or empty
                    data = await DealService.getGroupedBrandDeals();
                }
            } else {
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
