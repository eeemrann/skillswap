const express = require('express');
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { getSummary, connect, dashboard, create, list } = require('../controllers/payoutController');

const router = express.Router();
router.use(auth);
router.get('/summary', getSummary);
router.get('/', list);
router.post('/connect', writeLimiter, connect);
router.post('/connect/dashboard', writeLimiter, dashboard);
router.post('/', writeLimiter, create);

module.exports = router;
