const DealService = require('../services/DealService');

class SearchController {
    async search(req, res) {
        try {
            const query = req.query.q;
            if (!query) {
                return res.status(400).json({ error: "Query parameter 'q' is required" });
            }

            // Reuse existing searchProducts service which takes array
            // We pass single query as [query]
            const results = await DealService.searchProducts([query]);

            // Limit to top 10 results for "little non scrollable" UI
            const topResults = results.slice(0, 10);

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
