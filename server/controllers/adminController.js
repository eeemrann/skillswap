const mongoose = require('mongoose');
const { User, Booking, Transaction, Review, Payment } = require('../models');
const { PLANS } = require('../config/plans');
const { round2 } = require('../utils/money');
const { runInTransaction, HttpError } = require('../utils/transaction');
const { grantCredits } = require('../services/creditService');

const DAY = 86400000;

exports.getStats = async (req, res) => {
  const since = new Date(Date.now() - 30 * DAY);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [
    users, activeUsers, proUsers, completedBookings, pendingBookings, upcomingSessions, sessionsThisWeek, reviews,
    revenueTotal, revenue30d, feeTotal, newUsers30d, proMonthly, proYearly
  ] = await Promise.all([
    User.countDocuments(), User.countDocuments({ status: 'active' }), User.countDocuments({ plan: 'pro', planStatus: { $in: ['active', 'trialing', 'past_due'] } }),
    Booking.countDocuments({ status: 'completed' }), Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'accepted', proposedTime: { $gte: new Date() } }),
    Booking.countDocuments({ status: 'completed', completedAt: { $gte: weekAgo } }),
    Review.countDocuments(),
    Payment.aggregate([{ $group: { _id: null, cents: { $sum: '$amountCents' } } }]),
    Payment.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, cents: { $sum: '$amountCents' } } }]),
    Transaction.aggregate([{ $match: { type: 'session' } }, { $group: { _id: null, credits: { $sum: '$fee' } } }]),
    User.countDocuments({ createdAt: { $gte: since } }),
    User.countDocuments({ plan: 'pro', planInterval: 'month', planStatus: { $in: ['active', 'trialing'] } }),
    User.countDocuments({ plan: 'pro', planInterval: 'year', planStatus: { $in: ['active', 'trialing'] } })
  ]);
  const mrrCents = Math.round(proMonthly * PLANS.pro.priceMonthlyCents + proYearly * (PLANS.pro.priceYearlyCents / 12));
  res.json({
    users, activeUsers, proUsers, newUsers30d,
    completedBookings, pendingBookings, upcomingSessions, sessionsThisWeek, reviews,
    revenueTotalCents: revenueTotal[0]?.cents || 0,
    revenue30dCents: revenue30d[0]?.cents || 0,
    mrrCents,
    feeCreditsCollected: round2(feeTotal[0]?.credits || 0)
  });
};

exports.getUsers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filter = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] } : {};
  const [users, total] = await Promise.all([
    User.find(filter).select('-stripeCustomerId -stripeSubscriptionId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.set('X-Total-Count', String(total)).json(users);
};

exports.updateUserStatus = async (req, res) => {
  if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
  if (req.body.status === 'suspended' && String(req.userId) === String(req.params.id)) {
    return res.status(400).json({ message: 'Admins cannot suspend their own account.' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }).select('-stripeCustomerId -stripeSubscriptionId');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

/** Support tool: add (or remove) credits with an audit entry in the ledger. */
exports.adjustCredits = async (req, res) => {
  const amount = round2(Number(req.body.amount));
  const reason = String(req.body.reason || '').trim().slice(0, 150);
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, 'Invalid user id');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100) throw new HttpError(400, 'Amount must be between 0.01 and 100 credits');
  if (!reason) throw new HttpError(400, 'A reason is required');
  const user = await runInTransaction((session) => grantCredits(req.params.id, amount, { type: 'adjustment', description: `Support credit: ${reason}` }, session));
  res.json({ _id: user._id, creditBalance: round2(user.creditBalance + amount) });
};

exports.getPayments = async (req, res) => {
  const payments = await Payment.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(100);
  res.json(payments);
};

exports.deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json({ message: 'Review removed' });
};
