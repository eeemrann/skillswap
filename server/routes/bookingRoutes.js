const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { createBooking, getMyBookings, updateBookingStatus, completeBooking } = require('../controllers/bookingController');

router.post('/', auth, createBooking);
router.get('/', auth, getMyBookings);
router.patch('/:id/status', auth, updateBookingStatus);
router.patch('/:id/complete', auth, completeBooking);

module.exports = router;