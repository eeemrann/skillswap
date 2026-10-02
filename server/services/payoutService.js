const { User, Payout, Payment, Transaction } = require('../models');
const { economy, payoutCents, CURRENCY } = require('../config/plans');
const { appUrl } = require('../config');
const { round2, formatCents } = require('../utils/money');
const { runInTransaction, HttpError } = require('../utils/transaction');
const { loadUser, writeCredits, withdrawableCredits } = require('./creditService');
const { getStripe } = require('./stripeService');
const { queueEmail, createInAppNotification } = require('./notificationService');

const MAX_TRANSFER_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 2 * 60 * 1000;
const ELIGIBLE_TEACHER_STATUSES = ['approved', 'revoked']; // a removed teacher can still collect what they already earned

const connectState = (user) => {
  if (!user.stripeConnectId) return 'not_started';
  return user.payoutsEnabled ? 'ready' : 'incomplete';
};

const payoutsDisabled = () => new HttpError(503, 'Withdrawals are not available right now', { code: 'PAYOUTS_DISABLED' });

/** Reads the Connect account from Stripe and stores whether it can receive money. */
async function syncConnectAccount(user) {
  const stripe = getStripe();
  if (!stripe || !user.stripeConnectId) return user;
  const account = await stripe.accounts.retrieve(user.stripeConnectId);
  const enabled = Boolean(account.payouts_enabled);
  if (enabled !== Boolean(user.payoutsEnabled)) {
    await User.updateOne({ _id: user._id }, { payoutsEnabled: enabled });
    user.payoutsEnabled = enabled;
  }
  return user;
}

function requireTeacher(user) {
  if (!ELIGIBLE_TEACHER_STATUSES.includes(user.teacherStatus)) throw new HttpError(403, 'Only verified teachers can withdraw earnings');
}

/**
 * Starts (or resumes) Stripe's hosted identity and bank-details onboarding for a teacher.
 * Stripe verifies who they are and where the money goes; SkillSwap never handles bank details.
 */
async function startConnectOnboarding(user) {
  const stripe = getStripe();
  if (!stripe) throw payoutsDisabled();
  requireTeacher(user);
  let accountId = user.stripeConnectId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      metadata: { userId: String(user._id) }
    });
    accountId = account.id;
    await User.updateOne({ _id: user._id }, { stripeConnectId: accountId });
  }
  const base = appUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${base}/billing?connect=refresh`,
    return_url: `${base}/billing?connect=return`
  });
  return { url: link.url };
}

/** One-click link into Stripe's Express dashboard, where teachers see their transfers and bank details. */
async function connectDashboardLink(user) {
  const stripe = getStripe();
  if (!stripe) throw payoutsDisabled();
  if (!user.stripeConnectId) throw new HttpError(409, 'Set up payouts first', { code: 'CONNECT_REQUIRED' });
  const link = await stripe.accounts.createLoginLink(user.stripeConnectId);
  return { url: link.url };
}

/** Everything the wallet screen needs to explain what can be cashed out, and why not. */
async function payoutSummary(user) {
  const eco = economy();
  const withdrawable = await withdrawableCredits(user);
  const earned = round2(user.earnedCredits || 0);
  const payouts = await Payout.find({ user: user._id }).sort({ createdAt: -1 }).limit(20);
  const eligible = ELIGIBLE_TEACHER_STATUSES.includes(user.teacherStatus);
  return {
    enabled: Boolean(getStripe()),
    eligible,
    rateCentsPerCredit: eco.payoutCentsPerCredit,
    minPayoutCents: eco.minPayoutCents,
    minPayoutCredits: round2(Math.ceil((eco.minPayoutCents / eco.payoutCentsPerCredit) * 100) / 100),
    holdDays: eco.payoutHoldDays,
    currency: CURRENCY,
    firstPayoutReview: eco.reviewFirstPayout && !payouts.some((payout) => payout.status === 'paid') && !(await Payout.exists({ user: user._id, status: 'paid' })),
    earnedCredits: earned,
    withdrawableCredits: withdrawable,
    withdrawableCents: payoutCents(withdrawable),
    // Earned credits that are still inside the clearing window or reserved for a confirmed session.
    pendingCredits: Math.max(0, round2(earned - withdrawable)),
    connect: { status: connectState(user), payoutsEnabled: Boolean(user.payoutsEnabled) },
    blocked: Boolean(user.payoutsBlocked),
    blockedReason: user.payoutsBlocked ? user.payoutsBlockedReason || 'Withdrawals are on hold for your account.' : '',
    payouts
  };
}

/**
 * Turns earned credits into a payout. Credits leave the wallet in the same transaction that creates
 * the payout, so two simultaneous requests can never withdraw the same credits twice.
 */
async function requestPayout(userId, rawCredits) {
  const stripe = getStripe();
  if (!stripe) throw payoutsDisabled();
  const eco = economy();
  let user = await loadUser(userId);
  requireTeacher(user);
  if (user.payoutsBlocked) throw new HttpError(403, user.payoutsBlockedReason || 'Withdrawals are on hold for your account. Contact support.', { code: 'PAYOUTS_BLOCKED' });
  if (!user.stripeConnectId) throw new HttpError(409, 'Set up payouts before you withdraw', { code: 'CONNECT_REQUIRED' });
  user = await syncConnectAccount(user);
  if (!user.payoutsEnabled) throw new HttpError(409, 'Finish your payout setup with Stripe before you withdraw', { code: 'CONNECT_INCOMPLETE' });

  const credits = round2(rawCredits);
  if (!Number.isFinite(credits) || credits <= 0) throw new HttpError(400, 'Enter how many credits to withdraw');
  const cents = payoutCents(credits);
  if (cents < eco.minPayoutCents) throw new HttpError(400, `The minimum withdrawal is ${formatCents(eco.minPayoutCents, CURRENCY)}`, { code: 'BELOW_MINIMUM' });

  const needsReview = cents > eco.autoApprovePayoutCents || (eco.reviewFirstPayout && !(await Payout.exists({ user: userId, status: 'paid' })));
  const payout = await runInTransaction(async (session) => {
    const fresh = await loadUser(userId, session);
    if (fresh.payoutsBlocked) throw new HttpError(403, 'Withdrawals are on hold for your account. Contact support.', { code: 'PAYOUTS_BLOCKED' });
    const withdrawable = await withdrawableCredits(fresh, { session });
    if (credits > withdrawable) {
      throw new HttpError(409, withdrawable > 0 ? `You can withdraw up to ${withdrawable} credits right now` : 'You have no credits ready to withdraw yet', { code: 'EXCEEDS_WITHDRAWABLE', withdrawable });
    }
    await writeCredits(fresh, {
      balance: fresh.creditBalance - credits,
      earned: (fresh.earnedCredits || 0) - credits,
      earnedUsed: (fresh.earnedUsed || 0) + credits
    }, session);
    const [created] = await Payout.create([{
      user: fresh._id, credits, amountCents: cents, rateCentsPerCredit: eco.payoutCentsPerCredit, currency: CURRENCY,
      status: needsReview ? 'pending_review' : 'processing'
    }], { session });
    await Transaction.create([{ type: 'payout', from: fresh._id, amount: credits, payout: created._id, description: `Cash-out ${formatCents(cents, CURRENCY)}` }], { session });
    return created;
  });

  if (payout.status === 'pending_review') {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
    await Promise.all([
      createInAppNotification({ userId, type: 'payout', message: `Your ${formatCents(cents, CURRENCY)} withdrawal is waiting for a quick review`, relatedId: payout._id }),
      ...admins.map((admin) => createInAppNotification({ userId: admin._id, type: 'payout', message: `Payout of ${formatCents(cents, CURRENCY)} needs review`, relatedId: payout._id }))
    ]);
    return payout;
  }
  await executePayout(payout._id);
  return Payout.findById(payout._id);
}

const isPermanentStripeError = (error) => ['StripeInvalidRequestError', 'StripePermissionError'].includes(error?.type) && error.code !== 'balance_insufficient';

/**
 * Sends the money. The Stripe idempotency key is the payout id, so retrying after a crash or a
 * timeout can never pay twice. Temporary failures stay `processing` and are retried by the worker.
 */
async function executePayout(payoutId) {
  const payout = await Payout.findOneAndUpdate({ _id: payoutId, status: 'processing' }, { $inc: { attempts: 1 } }, { new: true });
  if (!payout) return null;
  const stripe = getStripe();
  const user = await User.findById(payout.user);
  if (!stripe || !user?.stripeConnectId) {
    return payout.attempts >= MAX_TRANSFER_ATTEMPTS ? failPayout(payout._id, 'Payouts are not configured', { status: 'failed' }) : payout;
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: payout.amountCents,
      currency: payout.currency,
      destination: user.stripeConnectId,
      transfer_group: `payout_${payout._id}`,
      description: `SkillSwap cash-out of ${payout.credits} credits`,
      metadata: { payoutId: String(payout._id), userId: String(user._id) }
    }, { idempotencyKey: `payout_${payout._id}` });

    const done = await Payout.updateOne({ _id: payout._id, status: 'processing' }, { status: 'paid', stripeTransferId: transfer.id, paidAt: new Date(), failureReason: '' });
    if (done.modifiedCount === 1) {
      await Promise.all([
        createInAppNotification({ userId: user._id, type: 'payout', message: `${formatCents(payout.amountCents, payout.currency)} is on its way to your bank`, relatedId: payout._id }),
        queueEmail('PAYOUT_SENT', user.email, { credits: payout.credits, amount: formatCents(payout.amountCents, payout.currency), url: `${appUrl()}/billing` })
      ]);
    }
    return Payout.findById(payout._id);
  } catch (error) {
    const permanent = isPermanentStripeError(error) || payout.attempts >= MAX_TRANSFER_ATTEMPTS;
    console.error('Payout transfer failed:', { payoutId: String(payout._id), attempt: payout.attempts, permanent, detail: error.message });
    if (permanent) return failPayout(payout._id, error.message, { status: 'failed' });
    await Payout.updateOne({ _id: payout._id }, { failureReason: String(error.message).slice(0, 300) });
    return Payout.findById(payout._id);
  }
}

/** Ends a payout without paying and returns the credits to the teacher's earned balance. */
async function failPayout(payoutId, reason, { status = 'failed', adminId } = {}) {
  const result = await runInTransaction(async (session) => {
    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['processing', 'pending_review'] } },
      { status, failureReason: String(reason || '').slice(0, 300), ...(adminId ? { reviewedBy: adminId, reviewedAt: new Date() } : {}) },
      { new: true, session }
    );
    if (!payout) return null;
    const user = await loadUser(payout.user, session);
    await writeCredits(user, {
      balance: (user.creditBalance || 0) + payout.credits,
      earned: (user.earnedCredits || 0) + payout.credits,
      earnedUsed: (user.earnedUsed || 0) - payout.credits
    }, session);
    await Transaction.create([{ type: 'payout_refund', to: user._id, amount: payout.credits, payout: payout._id, description: status === 'rejected' ? 'Withdrawal declined' : 'Withdrawal failed' }], { session });
    return payout;
  });
  if (result) {
    const user = await User.findById(result.user).select('email');
    const rejected = status === 'rejected';
    await Promise.all([
      createInAppNotification({ userId: result.user, type: 'payout', message: rejected ? 'Your withdrawal was declined and the credits are back in your wallet' : 'Your withdrawal could not be completed and the credits are back in your wallet', relatedId: result._id }),
      queueEmail('PAYOUT_FAILED', user?.email, { credits: result.credits, reason: rejected ? String(reason || 'Declined after review') : 'The bank transfer could not be completed.', url: `${appUrl()}/billing` })
    ]);
  }
  return result;
}

/**
 * Signals that help a reviewer judge a payout: how much of the teacher's recent income came from
 * learners who never paid for anything (i.e. who only spent free credits), which is what
 * collecting free credits through accounts the teacher controls would look like.
 */
async function payoutRiskSignals(userId) {
  const since = new Date(Date.now() - 90 * 86400000);
  const sessions = await Transaction.find({ type: 'session', to: userId, createdAt: { $gte: since } }).select('from amount fee').lean();
  const learnerIds = [...new Set(sessions.map((entry) => String(entry.from)))];
  const payers = new Set((await Payment.distinct('user', { user: { $in: learnerIds } })).map(String));
  const net = (entry) => (entry.amount || 0) - (entry.fee || 0);
  const total = sessions.reduce((sum, entry) => sum + net(entry), 0);
  const fromUnpaid = sessions.filter((entry) => !payers.has(String(entry.from))).reduce((sum, entry) => sum + net(entry), 0);
  return {
    sessions90d: sessions.length,
    uniqueLearners: learnerIds.length,
    unpaidLearnerSharePct: total > 0 ? Math.round((fromUnpaid / total) * 100) : 0
  };
}

/** An administrator releases a large payout that was held for review. */
async function approvePayout(payoutId, adminId) {
  const payout = await Payout.findOneAndUpdate({ _id: payoutId, status: 'pending_review' }, { status: 'processing', reviewedBy: adminId, reviewedAt: new Date() }, { new: true });
  if (!payout) {
    const existing = await Payout.findById(payoutId).select('status');
    if (!existing) throw new HttpError(404, 'Payout not found');
    throw new HttpError(409, `This payout is already ${existing.status.replace('_', ' ')}`);
  }
  await executePayout(payout._id);
  return Payout.findById(payout._id);
}

async function rejectPayout(payoutId, adminId, reason) {
  const text = String(reason || '').trim();
  if (text.length < 5) throw new HttpError(400, 'Give the teacher a reason');
  const payout = await failPayout(payoutId, text, { status: 'rejected', adminId });
  if (!payout) {
    const existing = await Payout.findById(payoutId).select('status');
    if (!existing) throw new HttpError(404, 'Payout not found');
    throw new HttpError(409, `This payout is already ${existing.status.replace('_', ' ')}`);
  }
  return payout;
}

/** Retries transfers that were interrupted (crash, network) and gives up cleanly after repeated failures. */
async function retryStalePayouts(now = new Date()) {
  const stale = await Payout.find({ status: 'processing', updatedAt: { $lte: new Date(now.getTime() - STALE_PROCESSING_MS) } }).select('_id').limit(25);
  for (const payout of stale) await executePayout(payout._id).catch((error) => console.error('Payout retry failed:', error.message));
}

function startPayoutWorker() {
  const intervalMs = Number(process.env.PAYOUT_WORKER_INTERVAL_MS || 60000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await retryStalePayouts(); } catch (error) { console.error('Payout worker failed:', error.message); } finally { running = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = {
  connectState, syncConnectAccount, startConnectOnboarding, connectDashboardLink, payoutSummary,
  requestPayout, executePayout, failPayout, approvePayout, rejectPayout, payoutRiskSignals, retryStalePayouts, startPayoutWorker
};
