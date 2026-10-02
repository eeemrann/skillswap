const { Payout } = require('../models');
const { payoutSummary, startConnectOnboarding, connectDashboardLink, requestPayout, syncConnectAccount } = require('../services/payoutService');

exports.getSummary = async (req, res) => {
  // Coming back from Stripe's onboarding, the webhook may not have landed yet: ask Stripe directly.
  if (req.user.stripeConnectId && !req.user.payoutsEnabled) {
    await syncConnectAccount(req.user).catch((error) => console.warn('Connect account sync failed:', error.message));
  }
  res.json(await payoutSummary(req.user));
};

exports.connect = async (req, res) => res.json(await startConnectOnboarding(req.user));

exports.dashboard = async (req, res) => res.json(await connectDashboardLink(req.user));

exports.create = async (req, res) => {
  const payout = await requestPayout(req.userId, req.body?.credits);
  res.status(201).json(payout);
};

exports.list = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  res.json(await Payout.find({ user: req.userId }).sort({ createdAt: -1 }).limit(limit));
};
