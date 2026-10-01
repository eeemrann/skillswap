const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { getCatalog, createCheckout, createPortal, getPayments } = require('../controllers/billingController');

// The Stripe webhook is mounted in app.js ahead of the JSON body parser.
router.get('/catalog', getCatalog);
router.get('/payments', auth, getPayments);
router.post('/checkout', auth, writeLimiter, createCheckout);
router.post('/portal', auth, writeLimiter, createPortal);

module.exports = router;
