const DealService = require('../services/DealService');

class SearchController {
    async search(req, res) {
        try {
            const query = req.query.q;
            if (!query) {
                return res.status(400).json({ error: "Query parameter 'q' is required" });
            }

            // Pass location options for filtering
            const options = {
                lat: req.query.lat,
                lon: req.query.lon,
                range: req.query.range
            };

            // Reuse existing searchProducts service which takes array
            // We pass single query as [query]
            const results = await DealService.searchProducts([query], options);

            // Limit to top 10 results for "little non scrollable" UI
            // Limit to top 10 results for "little non scrollable" UI
            const topResults = results.slice(0, 10).map(p => ({
                ...p,
                store: require('../mappers/DealMapper').formatStoreName(p.store) // FORMATTED
            }));

            res.json({
                query: query,
                count: topResults.length,
                results: topResults
            });
        } catch (error) {
            console.error("Search error:", error);
            res.status(500).json({ error: "Search failed" });
        }
    }
}

module.exports = new SearchController();
