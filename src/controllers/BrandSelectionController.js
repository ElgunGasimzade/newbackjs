const DealService = require('../services/DealService');

class BrandSelectionController {

    async getBrandDeals(req, res) {
        try {
            const { scanId } = req.query;

            // Log Client Location Request matching User Request
            const clientLat = req.query.lat || 'N/A';
            const clientLon = req.query.lon || 'N/A';
            console.log(`[BrandSelection] Request Rec'd. Location: ${clientLat}, ${clientLon}. ScanID: ${scanId || 'None'}`);

            let data;

            if (scanId) {
                // If we have a scanId, try to find the specific items user confirmed
                const ScanController = require('./ScanController');
                const scanItems = ScanController.getScanItems(scanId);

                if (scanItems && scanItems.length > 0) {
                    const groups = [];
                    const DealMapper = require('../mappers/DealMapper');

                    const lang = req.headers['accept-language']?.startsWith('az') ? 'az' : 'en';
                    const userLat = req.query.lat ? parseFloat(req.query.lat) : null;
                    const userLon = req.query.lon ? parseFloat(req.query.lon) : null;
                    const options = {
                        lat: userLat,
                        lon: userLon,
                        range: req.query.range
                    };

                    // User Request: "categorized inside items that send in scan page"
                    // Iterate and create a group for EACH scanned item
                    for (const item of scanItems) {
                        const query = item.name;
                        // Search for this specific item with location filtering
                        const matchingProducts = await DealService.searchProducts([query], options);

                        // Create a group for this item
                        if (matchingProducts.length > 0) {
                            groups.push(DealMapper.mapToBrandGroup(query, matchingProducts, lang, userLat, userLon));
                        }
                    }

                    data = { groups: groups };

                } else {
                    // Fallback if scanId invalid or empty
                    const options = {
                        lat: req.query.lat,
                        lon: req.query.lon,
                        range: req.query.range
                    };
                    data = await DealService.getGroupedBrandDeals(options);
                }
            } else {
                const options = {
                    lat: req.query.lat,
                    lon: req.query.lon,
                    range: req.query.range
                };
                data = await DealService.getGroupedBrandDeals(options);
            }

            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new BrandSelectionController();
