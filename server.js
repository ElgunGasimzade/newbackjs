const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// Mount all routes under /api/v1
app.use('/api/v1', apiRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Base: http://localhost:${PORT}/api/v1`);
    console.log(`- Auth: /auth/guest-login`);
    console.log(`- Home: /home/feed`);
    console.log(`- Scan: /scan/process`);
    console.log(`- Brands: /deals/brands`);
    console.log(`- Planning: /planning/optimize`);
    console.log(`- Trips: /trips/last`);
    console.log(`- Watchlist: /watchlist`);
});
