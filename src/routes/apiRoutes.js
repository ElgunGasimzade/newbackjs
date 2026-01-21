const express = require('express');
const router = express.Router();

// const AuthController = require('../controllers/AuthController');
const HomeController = require('../controllers/HomeController');
const ScanController = require('../controllers/ScanController');
const BrandSelectionController = require('../controllers/BrandSelectionController');
const PlanningController = require('../controllers/PlanningController');
const TripController = require('../controllers/TripController');
const WatchlistController = require('../controllers/WatchlistController');
const multer = require('multer');

// Configure multer for file uploads (needed for scan endpoints)
const upload = multer({ dest: 'uploads/' });

// Auth - REMOVED
// router.post('/auth/guest-login', (req, res) => AuthController.guestLogin(req, res));

// Home
router.get('/home/feed', (req, res) => HomeController.getHomeFeed(req, res));

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

module.exports = router;
