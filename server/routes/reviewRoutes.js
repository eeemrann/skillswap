const express = require('express');
const auth = require('../middleware/authMiddleware');
const { createReview, getUserReviews } = require('../controllers/reviewController');

const router = express.Router();
router.post('/', auth, createReview);
router.get('/user/:userId', auth, getUserReviews);
module.exports = router;
