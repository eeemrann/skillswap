const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser, makeBooking, hoursFromNow } = require('./helpers/factories');
const { User, Booking, Transaction } = require('../models');
const { requestBooking, acceptBooking, declineBooking, closeBooking, settleBooking } = require('../services/bookingService');
const { settleOverdue } = require('../services/sessionWorker');
const { recordJoin, recordLeave } = require('../services/sessionService');

jest.setTimeout(90000);
beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const balances = async (...users) => Promise.all(users.map(async (user) => {
  const fresh = await User.findById(user._id);
  return { balance: fresh.creditBalance, held: fresh.creditsHeld };
}));

const request = (learner, teacher, overrides = {}) => requestBooking({
  requesterId: learner._id, providerId: teacher._id, skill: 'Guitar', note: '', proposedTime: hoursFromNow(24), durationMinutes: 60, idempotencyKey: `key-${Math.random().toString(36).slice(2)}`, ...overrides
});

describe('requesting a session', () => {
  test('creates a pending booking priced at one credit per hour', async () => {
    const [learner, teacher] = [await makeUser({ plan: 'pro', planStatus: 'active' }), await makeUser()];
    const booking = await request(learner, teacher, { durationMinutes: 90 });
    expect(booking.status).toBe('pending');
    expect(booking.credits).toBe(1.5);
    expect(booking.escrow).toBe('none');
  });

  test('rejects when the learner cannot afford it, with a machine-readable code', async () => {
    const [learner, teacher] = [await makeUser({ creditBalance: 0.5 }), await makeUser()];
    await expect(request(learner, teacher)).rejects.toMatchObject({ status: 402, extra: { code: 'INSUFFICIENT_CREDITS', required: 1 } });
  });

  test('free plan is capped at 60 minutes and 3 active bookings; pro lifts both', async () => {
    const [learner, teacher] = [await makeUser({ creditBalance: 50 }), await makeUser()];
    await expect(request(learner, teacher, { durationMinutes: 120 })).rejects.toMatchObject({ status: 402, extra: { code: 'PLAN_LIMIT', limit: 'maxSessionMinutes' } });

    for (let i = 0; i < 3; i += 1) await request(learner, teacher, { proposedTime: hoursFromNow(24 + i * 3) });
    await expect(request(learner, teacher, { proposedTime: hoursFromNow(60) })).rejects.toMatchObject({ extra: { code: 'PLAN_LIMIT', limit: 'maxActiveBookings' } });

    await User.updateOne({ _id: learner._id }, { plan: 'pro', planStatus: 'active' });
    await expect(request(learner, teacher, { proposedTime: hoursFromNow(60), durationMinutes: 120 })).resolves.toMatchObject({ credits: 2 });
  });

  test('refuses overlapping times for either member', async () => {
    const [learner, teacher, other] = [await makeUser(), await makeUser(), await makeUser()];
    const start = hoursFromNow(24);
    await request(learner, teacher, { proposedTime: start });
    await expect(request(other, teacher, { proposedTime: new Date(start.getTime() + 30 * 60000) })).rejects.toMatchObject({ status: 409 });
  });

  test('rejects a skill the provider does not teach', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    await expect(request(learner, teacher, { skill: 'Welding' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('escrow', () => {
  test('accepting reserves credits and opens a video room; spendable balance drops', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const accepted = await acceptBooking((await request(learner, teacher))._id, teacher._id);
    expect(accepted.status).toBe('accepted');
    expect(accepted.escrow).toBe('held');
    expect(accepted.roomId).toMatch(/^[0-9a-f]{32}$/);
    expect(await balances(learner)).toEqual([{ balance: 5, held: 1 }]);
  });

  test('a learner cannot overcommit credits across several accepted sessions', async () => {
    const learner = await makeUser({ creditBalance: 1 });
    const [t1, t2] = [await makeUser(), await makeUser()];
    const first = await makeBooking(learner, t1, { proposedTime: hoursFromNow(24) });
    const second = await makeBooking(learner, t2, { proposedTime: hoursFromNow(48) });
    await acceptBooking(first._id, t1._id);
    await expect(acceptBooking(second._id, t2._id)).rejects.toMatchObject({ status: 409, extra: { code: 'LEARNER_INSUFFICIENT_CREDITS' } });
    expect((await Booking.findById(second._id)).status).toBe('pending');
  });

  test('only the provider can accept, and only once', async () => {
    const [learner, teacher, stranger] = [await makeUser(), await makeUser(), await makeUser()];
    const booking = await request(learner, teacher);
    await expect(acceptBooking(booking._id, stranger._id)).rejects.toMatchObject({ status: 403 });
    await acceptBooking(booking._id, teacher._id);
    await expect(acceptBooking(booking._id, teacher._id)).rejects.toMatchObject({ status: 409 });
    expect((await balances(learner))[0].held).toBe(1);
  });

  test('declining a request leaves credits untouched', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await request(learner, teacher);
    await declineBooking(booking._id, teacher._id);
    expect(await balances(learner)).toEqual([{ balance: 5, held: 0 }]);
  });

  test('cancelling an accepted session releases the reservation', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await acceptBooking((await request(learner, teacher))._id, teacher._id);
    const cancelled = await closeBooking(booking._id, { status: 'cancelled', byUserId: teacher._id, reason: 'Sick' });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.escrow).toBe('released');
    expect(await balances(learner)).toEqual([{ balance: 5, held: 0 }]);
    await expect(closeBooking(booking._id, { status: 'cancelled', byUserId: teacher._id })).rejects.toMatchObject({ status: 409 });
  });

  test('strangers cannot cancel', async () => {
    const [learner, teacher, stranger] = [await makeUser(), await makeUser(), await makeUser()];
    const booking = await request(learner, teacher);
    await expect(closeBooking(booking._id, { status: 'cancelled', byUserId: stranger._id })).rejects.toMatchObject({ status: 403 });
  });
});

describe('settlement', () => {
  const accepted = async (learner, teacher, overrides) => {
    const booking = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(-2), ...overrides });
    await User.updateOne({ _id: learner._id }, { $inc: { creditsHeld: booking.credits } });
    await Booking.updateOne({ _id: booking._id }, { status: 'accepted', escrow: 'held', roomId: 'a'.repeat(32) });
    return booking;
  };

  test('free-plan teacher keeps 90% and the platform keeps a 10% fee', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser({ creditBalance: 0 })];
    const booking = await accepted(learner, teacher);
    const { fee } = await settleBooking(booking._id, { byUserId: learner._id });
    expect(fee).toBe(0.1);
    expect(await balances(learner, teacher)).toEqual([{ balance: 4, held: 0 }, { balance: 0.9, held: 0 }]);
    const ledger = await Transaction.findOne({ booking: booking._id });
    expect(ledger).toMatchObject({ type: 'session', amount: 1, fee: 0.1 });
  });

  test('pro teacher pays no service fee', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser({ creditBalance: 0, plan: 'pro', planStatus: 'active' })];
    const booking = await accepted(learner, teacher, { durationMinutes: 90, credits: 1.5 });
    await settleBooking(booking._id, { byUserId: learner._id });
    expect(await balances(learner, teacher)).toEqual([{ balance: 3.5, held: 0 }, { balance: 1.5, held: 0 }]);
  });

  test('cannot be settled twice, so credits never move twice', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser({ creditBalance: 0 })];
    const booking = await accepted(learner, teacher);
    await settleBooking(booking._id, { byUserId: learner._id });
    await expect(settleBooking(booking._id, { byUserId: learner._id })).rejects.toMatchObject({ status: 409 });
    expect((await balances(teacher))[0].balance).toBe(0.9);
    expect(await Transaction.countDocuments({ booking: booking._id })).toBe(1);
  });

  test('concurrent confirmations settle exactly once', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser({ creditBalance: 0 })];
    const booking = await accepted(learner, teacher);
    const results = await Promise.allSettled([1, 2, 3].map(() => settleBooking(booking._id, { byUserId: learner._id })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await Transaction.countDocuments({ booking: booking._id })).toBe(1);
    expect(await balances(learner, teacher)).toEqual([{ balance: 4, held: 0 }, { balance: 0.9, held: 0 }]);
  });

  test('only the learner can confirm, and not before the session starts', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await accepted(learner, teacher);
    await expect(settleBooking(booking._id, { byUserId: teacher._id })).rejects.toMatchObject({ status: 403 });

    const future = await accepted(learner, teacher, { proposedTime: hoursFromNow(5) });
    await expect(settleBooking(future._id, { byUserId: learner._id })).rejects.toMatchObject({ status: 409 });
  });
});

describe('automatic closing', () => {
  const overdue = async (learner, teacher) => {
    const booking = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(-30), status: 'accepted', escrow: 'held', roomId: 'b'.repeat(32) });
    await User.updateOne({ _id: learner._id }, { $inc: { creditsHeld: 1 } });
    return booking;
  };
  const attend = async (booking, ...users) => {
    for (const user of users) { await recordJoin(booking._id, user._id); await recordLeave(booking._id, user._id, 600); }
  };

  test('settles a session both members attended once the confirmation window passes', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser({ creditBalance: 0 })];
    const booking = await overdue(learner, teacher);
    await attend(booking, learner, teacher);
    await settleOverdue();
    const settled = await Booking.findById(booking._id);
    expect(settled).toMatchObject({ status: 'completed', escrow: 'settled', autoCompleted: true });
    expect(await balances(learner, teacher)).toEqual([{ balance: 4, held: 0 }, { balance: 0.9, held: 0 }]);
  });

  test('releases the learner\'s credits when the teacher never showed up', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await overdue(learner, teacher);
    await attend(booking, learner);
    await settleOverdue();
    expect(await Booking.findById(booking._id)).toMatchObject({ status: 'expired', escrow: 'released' });
    expect(await balances(learner)).toEqual([{ balance: 5, held: 0 }]);
  });

  test('expires pending requests whose time has passed', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(-1) });
    await settleOverdue();
    expect((await Booking.findById(booking._id)).status).toBe('expired');
  });

  test('cancelling after a session that really took place is refused', async () => {
    const [learner, teacher] = [await makeUser(), await makeUser()];
    const booking = await overdue(learner, teacher);
    await attend(booking, learner, teacher);
    await expect(closeBooking(booking._id, { status: 'cancelled', byUserId: learner._id })).rejects.toMatchObject({ status: 409 });
  });
});
