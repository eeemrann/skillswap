const User = require('../models/User');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');

exports.getStats = async (req, res) => {
  const [users, activeUsers, completedBookings, pendingBookings, transactions, reviews] = await Promise.all([
    User.countDocuments(), User.countDocuments({ status: 'active' }), Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ status: 'pending' }), Transaction.countDocuments(), Review.countDocuments()
  ]);
  res.json({ users, activeUsers, completedBookings, pendingBookings, transactions, reviews });
};

exports.getUsers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [users, total] = await Promise.all([User.find().select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), User.countDocuments()]);
  res.set('X-Total-Count', String(total)).json(users);
};

exports.updateUserStatus = async (req, res) => {
  if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
  const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

exports.deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json({ message: 'Review removed' });
};
