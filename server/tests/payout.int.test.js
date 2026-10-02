process.env.STRIPE_SECRET_KEY = 'sk_test_payouts';

jest.mock('@clerk/express', () => ({
  getAuth: (req) => ({ userId: req.headers['x-test-user'] || null }),
  clerkMiddleware: () => (req, res, next) => next(),
  clerkClient: { users: { getUser: jest.fn(), deleteUser: jest.fn().mockResolvedValue({}) } },
  verifyToken: jest.fn()
}));

const mongoose = require('mongoose');
const request = require('supertest');
const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser, makeTeacher, makeBooking, hoursFromNow, daysAgo } = require('./helpers/factories');
const { User, Booking, Transaction, Payout, Payment, Notification, EmailJob } = require('../models');
const { setStripeClient } = require('../services/stripeService');
const { retryStalePayouts } = require('../services/payoutService');
const { settleBooking } = require('../services/bookingService');
const { withdrawableCredits } = require('../services/creditService');
const app = require('../app');

jest.setTimeout(120000);

const stripe = {
  accounts: { create: jest.fn(), retrieve: jest.fn(), createLoginLink: jest.fn() },
  accountLinks: { create: jest.fn() },
  transfers: { create: jest.fn() }
};

beforeAll(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await startDb();
});
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  jest.resetAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_payouts';
  setStripeClient(stripe);
  stripe.accounts.retrieve.mockResolvedValue({ payouts_enabled: true });
  stripe.transfers.create.mockResolvedValue({ id: 'tr_1' });
});

const as = (user) => ({
  get: (path) => request(app).get(path).set('x-test-user', user.clerkId),
  post: (path, body = {}) => request(app).post(path).set('x-test-user', user.clerkId).send(body)
});

/** A teacher whose earnings are in the wallet and (by default) past the clearing window. */
let accountCounter = 0;
const earner = async ({ earned = 10, clearedDaysAgo = 5, ...overrides } = {}) => {
  accountCounter += 1;
  const teacher = await makeTeacher({ creditBalance: earned, earnedCredits: earned, stripeConnectId: `acct_${accountCounter}`, payoutsEnabled: true, ...overrides });
  if (earned > 0) await Transaction.create({ type: 'session', from: new mongoose.Types.ObjectId(), to: teacher._id, amount: earned, fee: 0, createdAt: daysAgo(clearedDaysAgo) });
  return teacher;
};

const wallet = async (user) => {
  const { creditBalance, earnedCredits, earnedUsed, creditsHeld } = await User.findById(user._id);
  return { creditBalance, earnedCredits, earnedUsed, creditsHeld };
};

describe('what can be withdrawn', () => {
  test('only earnings past the clearing window count, and the summary explains the rest', async () => {
    const teacher = await earner({ earned: 10 });
    await Transaction.create({ type: 'session', from: new mongoose.Types.ObjectId(), to: teacher._id, amount: 4, fee: 0, createdAt: daysAgo(1) });
    await User.updateOne({ _id: teacher._id }, { creditBalance: 14, earnedCredits: 14 });

    const summary = (await as(teacher).get('/api/payouts/summary')).body;
    expect(summary).toMatchObject({
      enabled: true, eligible: true, rateCentsPerCredit: 800, minPayoutCents: 2000, minPayoutCredits: 2.5, holdDays: 3,
      earnedCredits: 14, withdrawableCredits: 10, withdrawableCents: 8000, pendingCredits: 4, connect: { status: 'ready', payoutsEnabled: true }, blocked: false
    });
  });

  test('net earnings after the platform fee are what clear, not the session price', async () => {
    const [learner, teacher] = [await makeUser(), await makeTeacher()];
    const booking = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(-2), status: 'accepted', escrow: 'held', roomId: 'a'.repeat(32), credits: 2, durationMinutes: 120 });
    await User.updateOne({ _id: learner._id }, { creditsHeld: 2 });
    await settleBooking(booking._id, { byUserId: learner._id });
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 1.76, earnedCredits: 1.76 });

    expect(await withdrawableCredits(await User.findById(teacher._id))).toBe(0); // just settled: still in the chargeback window
    await Transaction.updateOne({ booking: booking._id }, { createdAt: daysAgo(4) });
    expect(await withdrawableCredits(await User.findById(teacher._id))).toBe(1.76);
  });

  test('spending earned credits on lessons uses them up first-in-first-out', async () => {
    const teacher = await earner({ earned: 10 });
    await User.updateOne({ _id: teacher._id }, { creditBalance: 2, earnedCredits: 2, earnedUsed: 8 });
    expect(await withdrawableCredits(await User.findById(teacher._id))).toBe(2);
    await User.updateOne({ _id: teacher._id }, { creditsHeld: 1.5 }); // reserved for a confirmed session
    expect(await withdrawableCredits(await User.findById(teacher._id))).toBe(0.5);
  });

  test('bought credits are never withdrawable, however many there are', async () => {
    const buyer = await makeTeacher({ creditBalance: 500, stripeConnectId: 'acct_x', payoutsEnabled: true });
    const response = await as(buyer).post('/api/payouts', { credits: 100 });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'EXCEEDS_WITHDRAWABLE', withdrawable: 0 });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
  });
});

describe('cashing out', () => {
  test('debits the wallet, sends the money with an idempotency key, and records everything', async () => {
    const teacher = await earner({ earned: 10 });
    const response = await as(teacher).post('/api/payouts', { credits: 4 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'paid', credits: 4, amountCents: 3200, rateCentsPerCredit: 800, stripeTransferId: 'tr_1' });

    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3200, currency: 'usd', destination: teacher.stripeConnectId, metadata: expect.objectContaining({ payoutId: response.body._id }) }),
      { idempotencyKey: `payout_${response.body._id}` }
    );
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 6, earnedCredits: 6, earnedUsed: 4 });
    expect(await Transaction.findOne({ type: 'payout' })).toMatchObject({ amount: 4, from: teacher._id, payout: expect.anything() });
    expect(await Notification.countDocuments({ userId: teacher._id, type: 'payout' })).toBe(1);
    expect((await EmailJob.findOne({ type: 'PAYOUT_SENT' })).data).toMatchObject({ credits: 4, amount: '32.00 USD' });
    expect((await as(teacher).get('/api/payouts/summary')).body).toMatchObject({ withdrawableCredits: 6, payouts: [{ status: 'paid' }] });
  });

  test('refuses amounts below the minimum, above what is withdrawable, or that make no sense', async () => {
    const teacher = await earner({ earned: 10 });
    const small = await as(teacher).post('/api/payouts', { credits: 2 });
    expect(small.status).toBe(400);
    expect(small.body.code).toBe('BELOW_MINIMUM');
    const tooMuch = await as(teacher).post('/api/payouts', { credits: 11 });
    expect(tooMuch).toMatchObject({ status: 409 });
    expect(tooMuch.body).toMatchObject({ code: 'EXCEEDS_WITHDRAWABLE', withdrawable: 10 });
    for (const credits of ['abc', -5, 0, null, undefined, {}]) expect((await as(teacher).post('/api/payouts', { credits })).status).toBe(400);

    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(await Payout.countDocuments()).toBe(0);
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 10, earnedCredits: 10, earnedUsed: 0 });
  });

  test('earnings still inside the clearing window cannot be withdrawn yet', async () => {
    const teacher = await earner({ earned: 10, clearedDaysAgo: 1 });
    const response = await as(teacher).post('/api/payouts', { credits: 5 });
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/no credits ready/);
  });

  test('simultaneous requests can never withdraw the same credits twice', async () => {
    const teacher = await earner({ earned: 10 });
    const responses = await Promise.all([1, 2, 3, 4].map(() => as(teacher).post('/api/payouts', { credits: 10 })));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(3);
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    expect(await Payout.countDocuments()).toBe(1);
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 0, earnedCredits: 0, earnedUsed: 10 });
  });

  test('needs a payout account that Stripe confirms can receive money', async () => {
    const noAccount = await earner({ earned: 10, stripeConnectId: undefined, payoutsEnabled: false });
    const response = await as(noAccount).post('/api/payouts', { credits: 5 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONNECT_REQUIRED');

    const incomplete = await earner({ earned: 10, stripeConnectId: 'acct_inc', payoutsEnabled: false });
    stripe.accounts.retrieve.mockResolvedValueOnce({ id: 'acct_inc', payouts_enabled: false });
    expect((await as(incomplete).post('/api/payouts', { credits: 5 })).body.code).toBe('CONNECT_INCOMPLETE');

    // Stripe says they finished onboarding even though the webhook has not arrived yet.
    stripe.accounts.retrieve.mockResolvedValueOnce({ id: 'acct_inc', payouts_enabled: true });
    expect((await as(incomplete).post('/api/payouts', { credits: 5 })).status).toBe(201);
    expect((await User.findById(incomplete._id)).payoutsEnabled).toBe(true);
  });

  test('is limited to verified teachers and respects an administrator\'s hold', async () => {
    const learner = await earner({ earned: 10, teacherStatus: 'none' });
    expect((await as(learner).post('/api/payouts', { credits: 5 })).status).toBe(403);
    expect((await as(learner).get('/api/payouts/summary')).body.eligible).toBe(false);

    const held = await earner({ earned: 10, payoutsBlocked: true, payoutsBlockedReason: 'Under review' });
    const response = await as(held).post('/api/payouts', { credits: 5 });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'PAYOUTS_BLOCKED', message: 'Under review' });
    expect((await as(held).get('/api/payouts/summary')).body).toMatchObject({ blocked: true, blockedReason: 'Under review' });

    // A teacher whose access was withdrawn can still collect what they already earned, unless blocked.
    const revoked = await earner({ earned: 10, teacherStatus: 'revoked' });
    expect((await as(revoked).post('/api/payouts', { credits: 5 })).status).toBe(201);
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
  });

  test('reports clearly when payouts are not configured on this deployment', async () => {
    const teacher = await earner({ earned: 10 });
    delete process.env.STRIPE_SECRET_KEY;
    setStripeClient(null);
    const response = await as(teacher).post('/api/payouts', { credits: 5 });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PAYOUTS_DISABLED');
    expect((await as(teacher).get('/api/payouts/summary')).body.enabled).toBe(false);
  });
});

describe('when the transfer fails', () => {
  const stripeError = (type, code) => Object.assign(new Error(`Stripe said no (${type})`), { type, code });

  test('a permanent rejection returns the credits and tells the teacher', async () => {
    const teacher = await earner({ earned: 10 });
    stripe.transfers.create.mockRejectedValue(stripeError('StripeInvalidRequestError', 'account_invalid'));
    const response = await as(teacher).post('/api/payouts', { credits: 6 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'failed', failureReason: expect.stringMatching(/Stripe said no/) });
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 10, earnedCredits: 10, earnedUsed: 0 });
    expect(await Transaction.find({ payout: response.body._id }).sort({ type: 1 })).toEqual([
      expect.objectContaining({ type: 'payout', amount: 6 }), expect.objectContaining({ type: 'payout_refund', amount: 6 })
    ]);
    expect(await EmailJob.countDocuments({ type: 'PAYOUT_FAILED' })).toBe(1);
    expect((await as(teacher).get('/api/payouts/summary')).body.withdrawableCredits).toBe(10); // and they can try again
  });

  test('a temporary failure keeps the payout processing and the retry pays exactly once', async () => {
    const teacher = await earner({ earned: 10 });
    stripe.transfers.create.mockRejectedValueOnce(stripeError('StripeConnectionError'));
    const response = await as(teacher).post('/api/payouts', { credits: 6 });
    expect(response.body).toMatchObject({ status: 'processing', attempts: 1 });
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 4, earnedCredits: 4, earnedUsed: 6 });

    await retryStalePayouts(); // too soon: the worker leaves a fresh attempt alone
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);

    await retryStalePayouts(new Date(Date.now() + 10 * 60000));
    const paid = await Payout.findById(response.body._id);
    expect(paid).toMatchObject({ status: 'paid', stripeTransferId: 'tr_1', attempts: 2 });
    const keys = stripe.transfers.create.mock.calls.map((call) => call[1].idempotencyKey);
    expect(keys).toEqual([`payout_${paid._id}`, `payout_${paid._id}`]); // same key: Stripe can never pay twice
    expect(await Transaction.countDocuments({ type: 'payout_refund' })).toBe(0);
  });

  test('gives up after repeated failures and refunds instead of leaving credits in limbo', async () => {
    const teacher = await earner({ earned: 10 });
    stripe.transfers.create.mockRejectedValue(stripeError('StripeAPIError'));
    const response = await as(teacher).post('/api/payouts', { credits: 6 });
    for (let i = 0; i < 4; i += 1) await retryStalePayouts(new Date(Date.now() + (i + 1) * 60 * 60000));
    expect(await Payout.findById(response.body._id)).toMatchObject({ status: 'failed', attempts: 5 });
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 10, earnedCredits: 10, earnedUsed: 0 });
    expect(await Transaction.countDocuments({ type: 'payout_refund' })).toBe(1);
  });

  test('a payout is refunded at most once, however often it is failed', async () => {
    const teacher = await earner({ earned: 10 });
    stripe.transfers.create.mockRejectedValue(stripeError('StripeInvalidRequestError', 'account_invalid'));
    const response = await as(teacher).post('/api/payouts', { credits: 6 });
    const { failPayout } = require('../services/payoutService');
    await Promise.all([failPayout(response.body._id, 'again'), failPayout(response.body._id, 'again')]);
    expect(await Transaction.countDocuments({ type: 'payout_refund' })).toBe(1);
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 10, earnedCredits: 10, earnedUsed: 0 });
  });
});

describe('large payouts need a human', () => {
  const big = () => earner({ earned: 40 }); // 40 x $8 = $320, above the $250 auto-approval limit

  test('they wait for review with the credits already set aside, and nothing is sent', async () => {
    const [teacher, admin] = [await big(), await makeUser({ role: 'admin' })];
    const response = await as(teacher).post('/api/payouts', { credits: 40 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'pending_review', amountCents: 32000 });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 0, earnedCredits: 0, earnedUsed: 40 });
    expect(await Notification.countDocuments({ userId: admin._id, type: 'payout' })).toBe(1);
    expect((await as(admin).get('/api/admin/payouts?status=pending_review')).body).toHaveLength(1);
    expect((await as(admin).get('/api/admin/stats')).body).toMatchObject({ pendingPayouts: 1, payoutsInFlightCents: 32000, payoutsPaidCents: 0 });
  });

  test('an administrator approves it, and it is sent exactly once', async () => {
    const [teacher, admin] = [await big(), await makeUser({ role: 'admin' })];
    const { body: payout } = await as(teacher).post('/api/payouts', { credits: 40 });
    expect((await as(teacher).post(`/api/admin/payouts/${payout._id}/approve`)).status).toBe(403);

    const approved = await as(admin).post(`/api/admin/payouts/${payout._id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'paid', reviewedBy: String(admin._id) });
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    expect((await as(admin).post(`/api/admin/payouts/${payout._id}/approve`)).status).toBe(409);
    expect((await as(admin).post(`/api/admin/payouts/${payout._id}/reject`, { reason: 'Too late now' })).status).toBe(409);
    expect((await as(admin).get('/api/admin/stats')).body).toMatchObject({ pendingPayouts: 0, payoutsPaidCents: 32000 });
  });

  test('an administrator can decline it with a reason and the credits come back', async () => {
    const [teacher, admin] = [await big(), await makeUser({ role: 'admin' })];
    const { body: payout } = await as(teacher).post('/api/payouts', { credits: 40 });
    expect((await as(admin).post(`/api/admin/payouts/${payout._id}/reject`, { reason: '' })).status).toBe(400);
    const rejected = await as(admin).post(`/api/admin/payouts/${payout._id}/reject`, { reason: 'Earnings come from linked accounts' });
    expect(rejected.body).toMatchObject({ status: 'rejected', failureReason: 'Earnings come from linked accounts' });
    expect(await wallet(teacher)).toMatchObject({ creditBalance: 40, earnedCredits: 40, earnedUsed: 0 });
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect((await EmailJob.findOne({ type: 'PAYOUT_FAILED' })).data.reason).toMatch(/linked accounts/);
    expect((await as(admin).post(`/api/admin/payouts/${payout._id}/approve`)).status).toBe(409);
  });

  test('an administrator can freeze a member\'s withdrawals and release them again', async () => {
    const [teacher, admin] = [await earner({ earned: 10 }), await makeUser({ role: 'admin' })];
    expect((await as(admin).post(`/api/admin/users/${teacher._id}/payouts-block`, { blocked: true })).status).toBe(400);
    const frozen = await as(admin).post(`/api/admin/users/${teacher._id}/payouts-block`, { blocked: true, reason: 'Chargeback review' });
    expect(frozen.body).toMatchObject({ payoutsBlocked: true, payoutsBlockedReason: 'Chargeback review' });
    expect(frozen.body.stripeConnectId).toBeUndefined();
    expect((await as(teacher).post('/api/payouts', { credits: 5 })).status).toBe(403);
    await as(admin).post(`/api/admin/users/${teacher._id}/payouts-block`, { blocked: false });
    expect((await as(teacher).post('/api/payouts', { credits: 5 })).status).toBe(201);
  });
});

describe('first withdrawal and fraud signals', () => {
  test('the very first withdrawal of a teacher is always reviewed by a person; later small ones are automatic', async () => {
    process.env.PAYOUT_REVIEW_FIRST = 'true';
    try {
      const [teacher, admin] = [await earner({ earned: 10 }), await makeUser({ role: 'admin' })];
      expect((await as(teacher).get('/api/payouts/summary')).body.firstPayoutReview).toBe(true);
      const first = await as(teacher).post('/api/payouts', { credits: 3 });
      expect(first.body.status).toBe('pending_review');
      expect(stripe.transfers.create).not.toHaveBeenCalled();

      expect((await as(admin).post(`/api/admin/payouts/${first.body._id}/approve`)).body.status).toBe('paid');
      expect((await as(teacher).get('/api/payouts/summary')).body.firstPayoutReview).toBe(false);
      const second = await as(teacher).post('/api/payouts', { credits: 3 });
      expect(second.body.status).toBe('paid');
      expect(stripe.transfers.create).toHaveBeenCalledTimes(2);
    } finally {
      process.env.PAYOUT_REVIEW_FIRST = 'false';
    }
  });

  test('reviewers see how much of the income of a teacher came from learners who never paid anything', async () => {
    const [teacher, admin] = [await earner({ earned: 40 }), await makeUser({ role: 'admin' })];
    const [freeLoader, buyer] = [await makeUser(), await makeUser()];
    await Payment.create({ user: buyer._id, kind: 'credit_pack', externalId: 'cs_buyer', amountCents: 5000, credits: 5 });
    await Transaction.create({ type: 'session', from: freeLoader._id, to: teacher._id, amount: 3, fee: 0, createdAt: daysAgo(10) });
    await Transaction.create({ type: 'session', from: buyer._id, to: teacher._id, amount: 1, fee: 0, createdAt: daysAgo(9) });
    await as(teacher).post('/api/payouts', { credits: 40 }); // above the auto-approval limit

    const [row] = (await as(admin).get('/api/admin/payouts?status=pending_review')).body;
    expect(row.risk).toEqual({ sessions90d: 3, uniqueLearners: 3, unpaidLearnerSharePct: 98 });
    const processed = (await as(admin).get('/api/admin/payouts')).body.filter((payout) => payout.status !== 'pending_review');
    expect(processed.every((payout) => payout.risk === undefined)).toBe(true);
  });
});

describe('Stripe Connect onboarding', () => {
  test('creates one Express account per teacher and returns a fresh onboarding link each time', async () => {
    const teacher = await makeTeacher();
    stripe.accounts.create.mockResolvedValue({ id: 'acct_new' });
    stripe.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/abc' });

    const first = await as(teacher).post('/api/payouts/connect');
    expect(first.body).toEqual({ url: 'https://connect.stripe.com/setup/abc' });
    expect(stripe.accounts.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'express', email: teacher.email, capabilities: { transfers: { requested: true } }, metadata: { userId: String(teacher._id) } }));
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({ account: 'acct_new', type: 'account_onboarding', return_url: expect.stringContaining('/billing?connect=return') }));

    await as(teacher).post('/api/payouts/connect');
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(stripe.accountLinks.create).toHaveBeenCalledTimes(2);
    expect((await User.findById(teacher._id)).stripeConnectId).toBe('acct_new');
  });

  test('only verified teachers can start it, and the dashboard link needs an account', async () => {
    const learner = await makeUser();
    expect((await as(learner).post('/api/payouts/connect')).status).toBe(403);
    expect(stripe.accounts.create).not.toHaveBeenCalled();

    const teacher = await makeTeacher();
    expect((await as(teacher).post('/api/payouts/connect/dashboard')).body.code).toBe('CONNECT_REQUIRED');
    await User.updateOne({ _id: teacher._id }, { stripeConnectId: 'acct_x' });
    stripe.accounts.createLoginLink.mockResolvedValue({ url: 'https://connect.stripe.com/express/login' });
    expect((await as(teacher).post('/api/payouts/connect/dashboard')).body.url).toMatch(/express/);
  });

  test('coming back from onboarding refreshes the payout status straight from Stripe', async () => {
    const teacher = await makeTeacher({ stripeConnectId: 'acct_x', payoutsEnabled: false });
    expect((await as(teacher).get('/api/payouts/summary')).body.connect).toMatchObject({ status: 'ready', payoutsEnabled: true });
    expect((await User.findById(teacher._id)).payoutsEnabled).toBe(true);
  });
});

describe('payout history', () => {
  test('members only ever see their own payouts', async () => {
    const [a, b] = [await earner({ earned: 10 }), await earner({ earned: 10 })];
    await as(a).post('/api/payouts', { credits: 5 });
    await as(b).post('/api/payouts', { credits: 6 });
    const mine = (await as(a).get('/api/payouts')).body;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ credits: 5, user: String(a._id) });
    expect(await Booking.countDocuments()).toBe(0);
  });
});
