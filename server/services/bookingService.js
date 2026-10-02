const { Booking, User, Transaction } = require('../models');
const { planFor, serviceFee, creditsForDuration, TEACHER_RATES } = require('../config/plans');
const { appUrl } = require('../config');
const { round2 } = require('../utils/money');
const { runInTransaction, HttpError } = require('../utils/transaction');
const { availableCredits, holdCredits, releaseCredits, loadUser, writeCredits, earnedPortionOfSpend } = require('./creditService');
const { newRoomId, bothAttended } = require('./sessionService');
const { queueEmail, createInAppNotification } = require('./notificationService');

const bookingCredits = (booking) => (booking.credits ?? 1);
const idOf = (value) => String(value?._id || value);

/**
 * Finds a pending/accepted booking that overlaps [start, end) for any of the
 * given members. Works both inside and outside a transaction.
 */
function findConflict({ userIds, start, end, excludeId, session }) {
  const query = Booking.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: { $in: ['pending', 'accepted'] },
    $or: [{ requester: { $in: userIds } }, { provider: { $in: userIds } }],
    $expr: { $and: [
      { $lt: ['$proposedTime', end] },
      { $gt: [{ $add: ['$proposedTime', { $multiply: [{ $ifNull: ['$durationMinutes', 60] }, 60000] }] }, start] }
    ] }
  });
  return session ? query.session(session) : query;
}

const emailData = (booking, actor, extra = {}) => ({
  actor,
  skill: booking.skill,
  time: new Date(booking.proposedTime).toISOString(),
  duration: booking.durationMinutes,
  url: `${appUrl()}/bookings`,
  ...extra
});

/** Teacher confirms a request: re-checks conflicts, reserves the learner's credits and opens a video room. */
async function acceptBooking(bookingId, providerId) {
  const result = await runInTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (idOf(booking.provider) !== String(providerId)) throw new HttpError(403, 'Not authorized to update this booking');
    if (booking.status !== 'pending') throw new HttpError(409, 'Only pending bookings can be accepted or declined');
    if (booking.endsAt <= new Date()) throw new HttpError(409, 'This request is for a time that has already passed');

    const conflict = await findConflict({
      userIds: [booking.requester, booking.provider], start: booking.proposedTime, end: booking.endsAt, excludeId: booking._id, session
    });
    if (conflict) throw new HttpError(409, 'This time overlaps an existing booking');

    const teacher = await User.findById(booking.provider).select('teacherStatus').session(session);
    if (teacher?.teacherStatus !== 'approved') throw new HttpError(409, 'Your teacher verification is not active, so you cannot confirm sessions');

    const cost = bookingCredits(booking);
    await holdCredits(booking.requester, cost, session);
    booking.status = 'accepted';
    booking.escrow = 'held';
    booking.credits = cost;
    booking.roomId = booking.roomId || newRoomId();
    await booking.save({ session });
    return booking;
  });

  const [requester, provider] = await Promise.all([User.findById(result.requester).select('email timezone'), User.findById(result.provider).select('name')]);
  const providerName = provider?.name || 'Your teacher';
  await Promise.all([
    createInAppNotification({ userId: result.requester, type: 'booking', message: `${providerName} accepted your ${result.skill} session`, relatedId: result._id }),
    queueEmail('BOOKING_ACCEPTED', requester?.email, emailData(result, providerName, { timezone: requester?.timezone, url: `${appUrl()}/session/${result._id}` }))
  ]);
  return result;
}

async function declineBooking(bookingId, providerId) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, provider: providerId, status: 'pending' },
    { status: 'declined' },
    { new: true }
  );
  if (!booking) {
    const existing = await Booking.findById(bookingId).select('provider');
    if (!existing) throw new HttpError(404, 'Booking not found');
    if (idOf(existing.provider) !== String(providerId)) throw new HttpError(403, 'Not authorized to update this booking');
    throw new HttpError(409, 'Only pending bookings can be accepted or declined');
  }
  const [requester, provider] = await Promise.all([User.findById(booking.requester).select('email timezone'), User.findById(booking.provider).select('name')]);
  const providerName = provider?.name || 'The teacher';
  await Promise.all([
    createInAppNotification({ userId: booking.requester, type: 'booking', message: `${providerName} declined your ${booking.skill} request`, relatedId: booking._id }),
    queueEmail('BOOKING_DECLINED', requester?.email, emailData(booking, providerName, { timezone: requester?.timezone }))
  ]);
  return booking;
}

/**
 * Ends a booking without a payout (cancelled by a member, or expired by the
 * system), returning any reserved credits to the learner.
 */
async function closeBooking(bookingId, { status, byUserId, reason }) {
  const booking = await runInTransaction(async (session) => {
    const current = await Booking.findById(bookingId).session(session);
    if (!current) throw new HttpError(404, 'Booking not found');
    if (byUserId && ![idOf(current.requester), idOf(current.provider)].includes(String(byUserId))) throw new HttpError(403, 'Not authorized to cancel this booking');
    if (!['pending', 'accepted'].includes(current.status)) throw new HttpError(409, `This booking is already ${current.status}`);
    if (byUserId) {
      if (current.endsAt <= new Date() && bothAttended(current)) throw new HttpError(409, 'This session took place. Confirm it instead of cancelling.');
      if (current.endsAt <= new Date() && idOf(current.requester) !== String(byUserId)) throw new HttpError(409, 'Only the learner can cancel after the session time');
    }
    if (current.escrow === 'held') {
      await releaseCredits(current.requester, bookingCredits(current), session);
      current.escrow = 'released';
    }
    current.status = status;
    if (byUserId) current.cancelledBy = byUserId;
    if (reason) current.cancelReason = String(reason).slice(0, 300);
    await current.save({ session });
    return current;
  });

  if (status === 'cancelled' && byUserId) {
    const otherId = idOf(booking.requester) === String(byUserId) ? booking.provider : booking.requester;
    const [actor, other] = await Promise.all([User.findById(byUserId).select('name'), User.findById(otherId).select('email timezone')]);
    const actorName = actor?.name || 'A member';
    await Promise.all([
      createInAppNotification({ userId: otherId, type: 'booking', message: `${actorName} cancelled the ${booking.skill} session`, relatedId: booking._id }),
      queueEmail('BOOKING_CANCELLED', other?.email, emailData(booking, actorName, { timezone: other?.timezone }))
    ]);
  }
  return booking;
}

/**
 * Pays out a session: releases the learner's reservation, moves the credits to
 * the teacher minus the teacher plan's service fee, and writes the ledger entry.
 */
async function settleBooking(bookingId, { byUserId, auto = false } = {}) {
  const outcome = await runInTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (byUserId && idOf(booking.requester) !== String(byUserId)) throw new HttpError(403, 'Only the learner can confirm this session');
    if (booking.status !== 'accepted') throw new HttpError(409, 'Only accepted bookings can be completed');
    if (!auto && booking.proposedTime > new Date()) throw new HttpError(409, 'You can confirm a session once it has started');

    const cost = bookingCredits(booking);
    const requester = await loadUser(booking.requester, session);
    const provider = await loadUser(booking.provider, session);
    const wasHeld = booking.escrow === 'held';
    const spendable = wasHeld ? round2(requester.creditBalance - (requester.creditsHeld - cost)) : availableCredits(requester);
    if (spendable < cost) throw new HttpError(402, 'Insufficient credits to complete this booking', { code: 'INSUFFICIENT_CREDITS' });

    // The platform fee is taken from the teacher's side; what is left becomes earned (cash-out eligible) credit.
    const fee = serviceFee(cost, planFor(provider));
    const net = round2(cost - fee);
    const fromEarned = earnedPortionOfSpend(requester, cost);
    await writeCredits(requester, {
      balance: requester.creditBalance - cost,
      held: wasHeld ? (requester.creditsHeld || 0) - cost : requester.creditsHeld,
      earned: (requester.earnedCredits || 0) - fromEarned,
      earnedUsed: (requester.earnedUsed || 0) + fromEarned
    }, session);
    await writeCredits(provider, { balance: (provider.creditBalance || 0) + net, earned: (provider.earnedCredits || 0) + net }, session);
    await Transaction.create([{ type: 'session', from: requester._id, to: provider._id, amount: cost, fee, booking: booking._id, description: booking.skill }], { session });

    booking.status = 'completed';
    booking.escrow = 'settled';
    booking.completedAt = new Date();
    booking.autoCompleted = auto;
    await booking.save({ session });
    return { booking, requester, provider, cost, fee };
  });

  const { booking, requester, provider, cost, fee } = outcome;
  const earned = round2(cost - fee);
  await Promise.all([
    createInAppNotification({ userId: provider._id, type: 'credit', message: `You earned ${earned} credit${earned === 1 ? '' : 's'} for teaching ${booking.skill}`, relatedId: booking._id }),
    createInAppNotification({ userId: requester._id, type: 'credit', message: `${cost} credit${cost === 1 ? '' : 's'} used for ${booking.skill}`, relatedId: booking._id }),
    queueEmail('BOOKING_COMPLETED', provider.email, emailData(booking, requester.name, { timezone: provider.timezone, credits: earned, url: `${appUrl()}/billing` }))
  ]);
  return outcome;
}

/** Validates and creates a pending booking request. */
async function requestBooking({ requesterId, providerId, skill, note, proposedTime, durationMinutes, idempotencyKey }) {
  const [requester, provider] = await Promise.all([User.findById(requesterId), User.findById(providerId)]);
  if (!requester) throw new HttpError(404, 'Member not found');
  if (!provider) throw new HttpError(404, 'Provider not found');
  if (provider.status === 'suspended') throw new HttpError(403, 'This provider is unavailable');
  if (provider.teacherStatus !== 'approved') throw new HttpError(403, 'Sessions can only be booked with verified teachers');
  if (!provider.skillsOffered.some((item) => item.toLowerCase() === skill.toLowerCase())) throw new HttpError(400, 'This provider does not offer that skill');

  const plan = planFor(requester);
  if (durationMinutes > plan.maxSessionMinutes) {
    throw new HttpError(402, `The ${plan.name} plan supports sessions up to ${plan.maxSessionMinutes} minutes`, { code: 'PLAN_LIMIT', limit: 'maxSessionMinutes' });
  }
  const active = await Booking.countDocuments({ requester: requesterId, status: { $in: ['pending', 'accepted'] } });
  if (active >= plan.maxActiveBookings) {
    throw new HttpError(402, `The ${plan.name} plan allows ${plan.maxActiveBookings} active bookings at once`, { code: 'PLAN_LIMIT', limit: 'maxActiveBookings' });
  }

  const rate = provider.teacherProfile?.hourlyRateCredits ?? TEACHER_RATES.default;
  const credits = creditsForDuration(durationMinutes, rate);
  const available = availableCredits(requester);
  if (available < credits) {
    throw new HttpError(402, `This session costs ${credits} credit${credits === 1 ? '' : 's'} and you have ${available} available`, { code: 'INSUFFICIENT_CREDITS', required: credits, available });
  }

  const end = new Date(proposedTime.getTime() + durationMinutes * 60000);
  if (await findConflict({ userIds: [requester._id, provider._id], start: proposedTime, end })) {
    throw new HttpError(409, 'This time overlaps an existing booking');
  }

  const booking = await Booking.create({ requester: requesterId, provider: providerId, skill, note, proposedTime, durationMinutes, credits, rateCredits: rate, idempotencyKey });
  await Promise.all([
    createInAppNotification({ userId: provider._id, type: 'booking', message: `${requester.name} requested a ${skill} session`, relatedId: booking._id }),
    queueEmail('BOOKING_CREATED', provider.email, emailData(booking, requester.name, { timezone: provider.timezone, note }))
  ]);
  return booking;
}

module.exports = { findConflict, acceptBooking, declineBooking, closeBooking, settleBooking, requestBooking, bookingCredits };
