class WatchlistController {

    async getWatchlist(req, res) {
        // Return a mock watchlist response
        // Structure based on WatchlistResponse in Java (which likely contains a list of items)
        res.json({
            items: [],
            popularEssentials: ["Milk", "Bread", "Eggs", "Bananas", "Coffee"] // suggestions can stay
        });
    }
}

module.exports = new WatchlistController();
