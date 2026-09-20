const express = require('express');
const auth = require('../middleware/authMiddleware');
const { createReview, getUserReviews, getMyReviewedBookings } = require('../controllers/reviewController');
const router = express.Router();

router.get('/mine', auth, getMyReviewedBookings);
router.post('/', auth, createReview);
router.get('/user/:userId', auth, getUserReviews); // backwards-compatible alias
router.get('/:userId', auth, getUserReviews);
module.exports = router;
