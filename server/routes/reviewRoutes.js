const express = require('express');
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { createReview, getUserReviews, getMyReviewedBookings } = require('../controllers/reviewController');
const router = express.Router();

router.get('/mine', auth, getMyReviewedBookings);
router.post('/', auth, writeLimiter, createReview);
router.get('/:userId', auth, getUserReviews);
module.exports = router;
