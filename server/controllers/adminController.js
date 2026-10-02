const mongoose = require('mongoose');
const { User, Booking, Transaction, Review, Payment, TeacherApplication, Payout } = require('../models');
const { PLANS, economy } = require('../config/plans');
const { round2 } = require('../utils/money');
const { runInTransaction, HttpError } = require('../utils/transaction');
const { grantCredits } = require('../services/creditService');
const { listApplications, approveApplication, rejectApplication, revokeTeacher } = require('../services/teacherService');
const { approvePayout, rejectPayout, payoutRiskSignals } = require('../services/payoutService');

const DAY = 86400000;
const HIDDEN_USER_FIELDS = '-stripeCustomerId -stripeSubscriptionId -stripeConnectId';

const sum = (model, match, field) => model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: field } } }]).then((rows) => rows[0]?.total || 0);

exports.getStats = async (req, res) => {
  const since = new Date(Date.now() - 30 * DAY);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const eco = economy();
  const [
    users, activeUsers, proUsers, completedBookings, pendingBookings, upcomingSessions, sessionsThisWeek, reviews,
    revenueTotal, revenue30d, feeTotal, newUsers30d, proMonthly, proYearly,
    teachers, pendingApplications, pendingPayouts, paidOut, inFlight, sessionVolume, creditsOutstanding, earnedOutstanding
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
    User.countDocuments({ plan: 'pro', planInterval: 'year', planStatus: { $in: ['active', 'trialing'] } }),
    User.countDocuments({ teacherStatus: 'approved' }),
    TeacherApplication.countDocuments({ status: 'pending' }),
    Payout.countDocuments({ status: 'pending_review' }),
    sum(Payout, { status: 'paid' }, '$amountCents'),
    sum(Payout, { status: { $in: ['processing', 'pending_review'] } }, '$amountCents'),
    sum(Transaction, { type: 'session' }, '$amount'),
    sum(User, {}, '$creditBalance'),
    sum(User, {}, '$earnedCredits')
  ]);
  const mrrCents = Math.round(proMonthly * PLANS.pro.priceMonthlyCents + proYearly * (PLANS.pro.priceYearlyCents / 12));
  const feeCredits = round2(feeTotal[0]?.credits || 0);
  res.json({
    users, activeUsers, proUsers, newUsers30d,
    completedBookings, pendingBookings, upcomingSessions, sessionsThisWeek, reviews,
    revenueTotalCents: revenueTotal[0]?.cents || 0,
    revenue30dCents: revenue30d[0]?.cents || 0,
    mrrCents,
    feeCreditsCollected: feeCredits,
    teachers, pendingApplications, pendingPayouts,
    // Marketplace health: money in, money out, and what the platform still owes in credits.
    sessionVolumeCredits: round2(sessionVolume),
    commissionValueCents: Math.round(feeCredits * eco.payoutCentsPerCredit),
    payoutsPaidCents: paidOut,
    payoutsInFlightCents: inFlight,
    creditsOutstanding: round2(creditsOutstanding),
    earnedLiabilityCents: Math.round(round2(earnedOutstanding) * eco.payoutCentsPerCredit)
  });
};

exports.getUsers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const q = String(req.query.q || '').trim().slice(0, 80);
  const pattern = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  const filter = pattern ? { $or: [{ name: pattern }, { email: pattern }] } : {};
  const [users, total] = await Promise.all([
    User.find(filter).select(HIDDEN_USER_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.set('X-Total-Count', String(total)).json(users);
};

exports.updateUserStatus = async (req, res) => {
  if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
  if (req.body.status === 'suspended' && String(req.userId) === String(req.params.id)) {
    return res.status(400).json({ message: 'Admins cannot suspend their own account.' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }).select(HIDDEN_USER_FIELDS);
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

const objectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${label} id`);
  return value;
};

/** Teacher verification queue. `status` is pending (default), approved, rejected, revoked or all. */
exports.getTeacherApplications = async (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'revoked', 'all'].includes(req.query.status) ? req.query.status : 'pending';
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const { items, total } = await listApplications({ status, page, limit });
  res.set('X-Total-Count', String(total)).json(items);
};

exports.approveTeacherApplication = async (req, res) => {
  const application = await approveApplication(objectId(req.params.id, 'application'), req.userId, {
    skills: req.body.skills,
    tier: req.body.tier || 'standard',
    rateCredits: req.body.rateCredits === undefined || req.body.rateCredits === '' ? undefined : Number(req.body.rateCredits),
    notes: req.body.notes
  });
  res.json(application);
};

exports.rejectTeacherApplication = async (req, res) => {
  const application = await rejectApplication(objectId(req.params.id, 'application'), req.userId, { reason: req.body.reason, notes: req.body.notes });
  res.json(application);
};

exports.revokeTeacher = async (req, res) => {
  res.json(await revokeTeacher(objectId(req.params.id, 'user'), req.userId, req.body.reason));
};

exports.getPayouts = async (req, res) => {
  const status = ['pending_review', 'processing', 'paid', 'failed', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const payouts = await Payout.find(status ? { status } : {}).populate('user', 'name email teacherStatus').sort({ createdAt: -1 }).limit(100);
  // Risk signals are only worth computing for payouts that are still waiting for a human.
  const rows = await Promise.all(payouts.map(async (payout) => {
    const plain = payout.toObject();
    if (payout.status === 'pending_review') plain.risk = await payoutRiskSignals(payout.user?._id || payout.user);
    return plain;
  }));
  res.json(rows);
};

exports.approvePayout = async (req, res) => res.json(await approvePayout(objectId(req.params.id, 'payout'), req.userId));

exports.rejectPayout = async (req, res) => res.json(await rejectPayout(objectId(req.params.id, 'payout'), req.userId, req.body.reason));

/** Freezes (or releases) a member's withdrawals, e.g. during a fraud or chargeback review. */
exports.setPayoutsBlocked = async (req, res) => {
  const blocked = Boolean(req.body.blocked);
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  if (blocked && !reason) throw new HttpError(400, 'A reason is required to block withdrawals');
  const user = await User.findByIdAndUpdate(objectId(req.params.id, 'user'), { payoutsBlocked: blocked, payoutsBlockedReason: blocked ? reason : '' }, { new: true }).select(HIDDEN_USER_FIELDS);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
};
