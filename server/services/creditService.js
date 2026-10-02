const mongoose = require('mongoose');
const { User, Transaction } = require('../models');
const { economy } = require('../config/plans');
const { round2 } = require('../utils/money');
const { HttpError } = require('../utils/transaction');

/** Credits a member can still commit to new sessions. */
const availableCredits = (user) => round2((user.creditBalance || 0) - (user.creditsHeld || 0));

const loadUser = async (id, session) => {
  const user = await User.findById(id).session(session || null);
  if (!user) throw new HttpError(404, 'Member not found');
  return user;
};

/** Writes the given balance fields (balance, held, earned, earnedUsed); omitted fields are left alone. */
const writeCredits = (user, { balance, held, earned, earnedUsed }, session) => {
  const set = {};
  if (balance !== undefined) set.creditBalance = round2(balance);
  if (held !== undefined) set.creditsHeld = Math.max(0, round2(held));
  if (earned !== undefined) set.earnedCredits = Math.max(0, round2(earned));
  if (earnedUsed !== undefined) set.earnedUsed = Math.max(0, round2(earnedUsed));
  return User.updateOne({ _id: user._id }, { $set: set }, { session });
};

/**
 * Bought, welcome and support credits are spent before earned credits, so a teacher who also
 * learns keeps as much as possible in the part of the wallet that can be cashed out.
 * Returns how much of a debit of `amount` has to come out of the earned part.
 */
const earnedPortionOfSpend = (user, amount) => {
  const nonEarned = Math.max(0, round2((user.creditBalance || 0) - (user.earnedCredits || 0)));
  return Math.min(round2(user.earnedCredits || 0), round2(Math.max(0, amount - nonEarned)));
};

/**
 * Adds credits to a member and records the ledger entry. Must run inside a
 * transaction so the balance and ledger cannot diverge.
 */
async function grantCredits(userId, amount, { type, description = '' }, session) {
  const user = await loadUser(userId, session);
  await writeCredits(user, { balance: (user.creditBalance || 0) + amount }, session);
  await Transaction.create([{ type, to: user._id, amount: round2(amount), description }], { session });
  return user;
}

/** Reserves `amount` of the learner's credits for an accepted session. */
async function holdCredits(userId, amount, session) {
  const user = await loadUser(userId, session);
  if (availableCredits(user) < amount) {
    throw new HttpError(409, 'The learner no longer has enough credits to confirm this session', { code: 'LEARNER_INSUFFICIENT_CREDITS' });
  }
  await writeCredits(user, { held: (user.creditsHeld || 0) + amount }, session);
}

/** Returns reserved credits to the learner's spendable balance. */
async function releaseCredits(userId, amount, session) {
  const user = await loadUser(userId, session);
  await writeCredits(user, { held: (user.creditsHeld || 0) - amount }, session);
}

/**
 * Net credits the member earned from sessions that settled at least `payoutHoldDays` ago.
 * Newer earnings are still inside the chargeback window and cannot be cashed out yet.
 */
async function clearedEarnings(userId, { session, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - economy().payoutHoldDays * 86400000);
  const [row] = await Transaction.aggregate([
    { $match: { type: 'session', to: new mongoose.Types.ObjectId(String(userId)), createdAt: { $lte: cutoff } } },
    { $group: { _id: null, net: { $sum: { $subtract: ['$amount', { $ifNull: ['$fee', 0] }] } } } }
  ]).session(session || null);
  return round2(row?.net || 0);
}

/**
 * Credits that can be cashed out right now: cleared earnings that were not already spent or
 * withdrawn (first in, first out), never more than the earned or the free part of the wallet.
 */
async function withdrawableCredits(user, { session, now } = {}) {
  const cleared = await clearedEarnings(user._id, { session, now });
  const unspent = round2(cleared - (user.earnedUsed || 0));
  return Math.max(0, Math.min(unspent, round2(user.earnedCredits || 0), availableCredits(user)));
}

module.exports = {
  availableCredits, grantCredits, holdCredits, releaseCredits, loadUser, writeCredits, earnedPortionOfSpend, clearedEarnings, withdrawableCredits
};
