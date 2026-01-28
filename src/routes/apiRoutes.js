const express = require('express');
const router = express.Router();

// const AuthController = require('../controllers/AuthController');
const HomeController = require('../controllers/HomeController');
const ScanController = require('../controllers/ScanController');
const BrandSelectionController = require('../controllers/BrandSelectionController');
const PlanningController = require('../controllers/PlanningController');
const TripController = require('../controllers/TripController');
const WatchlistController = require('../controllers/WatchlistController');
const SearchController = require('../controllers/SearchController');
const multer = require('multer');

// Configure multer for file uploads (needed for scan endpoints)
const upload = multer({ dest: 'uploads/' });

// Auth - REMOVED
// router.post('/auth/guest-login', (req, res) => AuthController.guestLogin(req, res));

// Home
router.get('/home/feed', (req, res) => HomeController.getHomeFeed(req, res));
router.get('/stores', (req, res) => HomeController.getAvailableStores(req, res));
router.get('/search', (req, res) => SearchController.search(req, res));

// Scan
router.post('/scan/process', upload.single('file'), (req, res) => ScanController.processScan(req, res));
router.post('/scan/:scanId/confirm', (req, res) => ScanController.confirmScan(req, res));

// Brands (Deals)
router.get('/deals/brands', (req, res) => BrandSelectionController.getBrandDeals(req, res));

// Planning
router.post('/planning/optimize', (req, res) => PlanningController.optimizePlan(req, res));
router.get('/planning/route/:optionId', (req, res) => PlanningController.getRouteDetails(req, res));

// Trips
router.post('/trips', (req, res) => TripController.saveTrip(req, res));
router.get('/trips/last', (req, res) => TripController.getLastTrip(req, res));

// Watchlist
router.get('/watchlist', (req, res) => WatchlistController.getWatchlist(req, res));

const AuthController = require('../controllers/AuthController');
const PlanController = require('../controllers/PlanController');

// ... existing controllers ...

router.post('/auth/device-login', (req, res) => AuthController.loginDevice(req, res));
router.put('/auth/profile', (req, res) => AuthController.updateProfile(req, res));

router.post('/plans', (req, res) => PlanController.savePlan(req, res));
router.get('/plans/:userId', (req, res) => PlanController.getPlans(req, res));
router.post('/plans/:planId/items', (req, res) => PlanController.addItemToPlan(req, res));
router.put('/plans/:planId/complete', (req, res) => PlanController.completePlan(req, res));
router.delete('/plans/:planId', (req, res) => PlanController.deletePlan(req, res));
router.get('/plans/:userId/stats', (req, res) => PlanController.getStats(req, res));

module.exports = router;
