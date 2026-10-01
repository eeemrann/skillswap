const { User, Transaction } = require('../models');
const { round2 } = require('../utils/money');
const { HttpError } = require('../utils/transaction');

/** Credits a member can still commit to new sessions. */
const availableCredits = (user) => round2((user.creditBalance || 0) - (user.creditsHeld || 0));

const loadUser = async (id, session) => {
  const user = await User.findById(id).session(session || null);
  if (!user) throw new HttpError(404, 'Member not found');
  return user;
};

const writeCredits = (user, { balance, held }, session) => User.updateOne(
  { _id: user._id },
  { $set: { creditBalance: round2(balance), creditsHeld: Math.max(0, round2(held)) } },
  { session }
);

/**
 * Adds credits to a member and records the ledger entry. Must run inside a
 * transaction so the balance and ledger cannot diverge.
 */
async function grantCredits(userId, amount, { type, description = '' }, session) {
  const user = await loadUser(userId, session);
  await writeCredits(user, { balance: (user.creditBalance || 0) + amount, held: user.creditsHeld || 0 }, session);
  await Transaction.create([{ type, to: user._id, amount: round2(amount), description }], { session });
  return user;
}

/** Reserves `amount` of the learner's credits for an accepted session. */
async function holdCredits(userId, amount, session) {
  const user = await loadUser(userId, session);
  if (availableCredits(user) < amount) {
    throw new HttpError(409, 'The learner no longer has enough credits to confirm this session', { code: 'LEARNER_INSUFFICIENT_CREDITS' });
  }
  await writeCredits(user, { balance: user.creditBalance, held: (user.creditsHeld || 0) + amount }, session);
}

/** Returns reserved credits to the learner's spendable balance. */
async function releaseCredits(userId, amount, session) {
  const user = await loadUser(userId, session);
  await writeCredits(user, { balance: user.creditBalance, held: (user.creditsHeld || 0) - amount }, session);
}

module.exports = { availableCredits, grantCredits, holdCredits, releaseCredits, loadUser, writeCredits };
