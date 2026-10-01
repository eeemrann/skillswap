const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const User = require('../models/User');
const { createInAppNotification } = require('../services/notificationService');

exports.createReview = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';
    if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid booking id' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });
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
    console.error('Review creation failed:', err.message);
    res.status(400).json({ message: 'Review could not be created' });
  }
};

exports.getUserReviews = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const reviewee = new mongoose.Types.ObjectId(req.params.userId);
  const [reviews, summary] = await Promise.all([
    Review.find({ reviewee }).populate('reviewer', 'name profilePicture').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.aggregate([{ $match: { reviewee } }, { $group: { _id: null, totalReviews: { $sum: 1 }, averageRating: { $avg: '$rating' } } }])
  ]);
  const totalReviews = summary[0]?.totalReviews || 0;
  const averageRating = summary[0] ? Number(summary[0].averageRating.toFixed(1)) : 0;
  res.json({ averageRating, totalReviews, reviews });
};

exports.getMyReviewedBookings = async (req, res) => {
  const reviews = await Review.find({ reviewer: req.userId }).select('booking');
  res.json(reviews.map((r) => r.booking.toString()));
};
