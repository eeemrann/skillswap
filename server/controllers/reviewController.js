const Booking = require('../models/Booking');
const Review = require('../models/Review');

exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(400).json({ message: 'Reviews are available after completion' });

    const isRequester = booking.requester.toString() === req.userId;
    const isProvider = booking.provider.toString() === req.userId;
    if (!isRequester && !isProvider) return res.status(403).json({ message: 'Only booking participants can review' });

    const reviewee = isRequester ? booking.provider : booking.requester;
    const review = await Review.create({ booking: bookingId, reviewer: req.userId, reviewee, rating, comment });
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'You already reviewed this booking' });
    res.status(400).json({ message: err.message || 'Review could not be created' });
  }
};

exports.getUserReviews = async (req, res) => {
  const reviews = await Review.find({ reviewee: req.params.userId })
    .populate('reviewer', 'name')
    .sort({ createdAt: -1 });
  res.json(reviews);
};

exports.getMyReviewedBookings = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewer: req.userId }).select('booking');
    res.json(reviews.map(r => r.booking.toString()));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
