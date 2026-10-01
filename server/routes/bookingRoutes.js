const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { createBooking, getMyBookings, updateBookingStatus, cancelBooking, completeBooking } = require('../controllers/bookingController');

router.post('/', auth, writeLimiter, createBooking);
router.get('/', auth, getMyBookings);
router.patch('/:id/status', auth, writeLimiter, updateBookingStatus);
router.patch('/:id/cancel', auth, writeLimiter, cancelBooking);
router.patch('/:id/complete', auth, writeLimiter, completeBooking);

module.exports = router;
