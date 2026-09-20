const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const User = require('../models/User');
const { createInAppNotification } = require('../services/notificationService');

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
    const reviewer = await User.findById(req.userId).select('name');
    await createInAppNotification({
      userId: reviewee,
      type: 'review',
      message: `${reviewer?.name || 'A SkillSwap member'} left you a ${rating}-star review`,
      relatedId: review._id
    });
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'You already reviewed this booking' });
    res.status(400).json({ message: err.message || 'Review could not be created' });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name profilePicture')
      .sort({ createdAt: -1 });
    const totalReviews = reviews.length;
    const averageRating = totalReviews
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1))
      : 0;
    res.json({ averageRating, totalReviews, reviews });
  } catch (err) {
    res.status(500).json({ message: 'Could not load reviews', error: err.message });
  }
};

exports.getMyReviewedBookings = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewer: req.userId }).select('booking');
    res.json(reviews.map(r => r.booking.toString()));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
