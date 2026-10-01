process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk';

const request = require('supertest');
const Stripe = require('stripe');
const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser } = require('./helpers/factories');
const { User, Payment, Transaction } = require('../models');
const { setStripeClient } = require('../services/stripeService');
const app = require('../app');

jest.setTimeout(90000);

const stripe = new Stripe('sk_test_unit');
stripe.subscriptions.retrieve = jest.fn();

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await startDb();
  setStripeClient(stripe);
});
afterAll(stopDb);
beforeEach(async () => { await clearDb(); jest.clearAllMocks(); });

const send = (event, { secret = process.env.STRIPE_WEBHOOK_SECRET, signature } = {}) => {
  const payload = JSON.stringify(event);
  const header = signature || stripe.webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload);
};

const packEvent = (user, id = 'cs_test_1', packId = 'pack_10') => ({
  id: `evt_${id}`, type: 'checkout.session.completed',
  data: { object: { id, object: 'checkout.session', payment_status: 'paid', amount_total: 2500, currency: 'usd', customer: 'cus_1', client_reference_id: String(user._id), metadata: { userId: String(user._id), kind: 'credit_pack', packId } } }
});

describe('Stripe webhook', () => {
  test('rejects a missing or forged signature without touching any balance', async () => {
    const user = await makeUser();
    const forged = await send(packEvent(user), { secret: 'whsec_wrong' });
    expect(forged.status).toBe(400);
    const missing = await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').send(JSON.stringify(packEvent(user)));
    expect(missing.status).toBe(400);
    expect((await User.findById(user._id)).creditBalance).toBe(5);
  });

  test('grants credits for a paid pack, records the payment and ledger entry', async () => {
    const user = await makeUser();
    const response = await send(packEvent(user));
    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).creditBalance).toBe(15);
    expect(await Payment.findOne({ externalId: 'cs_test_1' })).toMatchObject({ kind: 'credit_pack', credits: 10, amountCents: 2500 });
    expect(await Transaction.findOne({ to: user._id, type: 'purchase' })).toMatchObject({ amount: 10 });
  });

  test('is idempotent: replayed deliveries never grant credits twice', async () => {
    const user = await makeUser();
    await send(packEvent(user));
    await send(packEvent(user));
    await Promise.all([send(packEvent(user)), send(packEvent(user))]);
    expect((await User.findById(user._id)).creditBalance).toBe(15);
    expect(await Payment.countDocuments()).toBe(1);
  });

  test('ignores unpaid sessions and unknown packs', async () => {
    const user = await makeUser();
    const unpaid = packEvent(user, 'cs_unpaid');
    unpaid.data.object.payment_status = 'unpaid';
    await send(unpaid);
    await send(packEvent(user, 'cs_bogus', 'pack_999999'));
    expect((await User.findById(user._id)).creditBalance).toBe(5);
  });

  test('activates Pro and grants monthly credits when a subscription invoice is paid', async () => {
    const user = await makeUser({ stripeCustomerId: 'cus_pro' });
    const subscription = { id: 'sub_1', customer: 'cus_pro', status: 'active', cancel_at_period_end: false, current_period_end: Math.floor(Date.now() / 1000) + 2592000, metadata: { userId: String(user._id), interval: 'month' } };
    stripe.subscriptions.retrieve.mockResolvedValue(subscription);
    const event = { id: 'evt_inv', type: 'invoice.paid', data: { object: { id: 'in_1', status: 'paid', customer: 'cus_pro', subscription: 'sub_1', amount_paid: 1200, currency: 'usd', hosted_invoice_url: 'https://invoice.stripe.com/x' } } };

    expect((await send(event)).status).toBe(200);
    await send(event); // replay
    const fresh = await User.findById(user._id);
    expect(fresh).toMatchObject({ plan: 'pro', planStatus: 'active', planInterval: 'month', stripeSubscriptionId: 'sub_1', creditBalance: 9 });
    expect(await Payment.countDocuments({ kind: 'subscription' })).toBe(1);
  });

  test('yearly Pro grants twelve months of credits up front', async () => {
    const user = await makeUser({ stripeCustomerId: 'cus_year' });
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_y', customer: 'cus_year', status: 'active', metadata: { userId: String(user._id), interval: 'year' } });
    await send({ id: 'evt_y', type: 'invoice.paid', data: { object: { id: 'in_y', status: 'paid', customer: 'cus_year', subscription: 'sub_y', amount_paid: 11900, currency: 'usd' } } });
    expect(await User.findById(user._id)).toMatchObject({ planInterval: 'year', creditBalance: 53 });
  });

  test('downgrades to Free when the subscription is deleted, keeping earned credits', async () => {
    const user = await makeUser({ stripeCustomerId: 'cus_gone', plan: 'pro', planStatus: 'active', stripeSubscriptionId: 'sub_gone', creditBalance: 7 });
    const response = await send({ id: 'evt_del', type: 'customer.subscription.deleted', data: { object: { id: 'sub_gone', customer: 'cus_gone', status: 'canceled', metadata: { userId: String(user._id) } } } });
    expect(response.status).toBe(200);
    const fresh = await User.findById(user._id);
    expect(fresh).toMatchObject({ plan: 'free', creditBalance: 7 });
    expect(fresh.stripeSubscriptionId).toBeUndefined();
  });

  test('keeps Pro during payment retries (past_due) and flags a scheduled cancellation', async () => {
    const user = await makeUser({ stripeCustomerId: 'cus_retry' });
    await send({ id: 'evt_up', type: 'customer.subscription.updated', data: { object: { id: 'sub_r', customer: 'cus_retry', status: 'past_due', cancel_at_period_end: true, metadata: { userId: String(user._id), interval: 'month' } } } });
    expect(await User.findById(user._id)).toMatchObject({ plan: 'pro', planStatus: 'past_due', cancelAtPeriodEnd: true });
  });

  test('acknowledges event types it does not handle', async () => {
    expect((await send({ id: 'evt_x', type: 'customer.created', data: { object: {} } })).status).toBe(200);
  });
});

describe('billing endpoints', () => {
  test('the catalog is public and describes plans, packs and billing availability', async () => {
    const response = await request(app).get('/api/billing/catalog');
    expect(response.status).toBe(200);
    expect(response.body.plans.map((plan) => plan.id)).toEqual(['free', 'pro']);
    expect(response.body.packs).toHaveLength(3);
    expect(response.body.billingEnabled).toBe(true);
  });

  test('checkout requires authentication', async () => {
    const response = await request(app).post('/api/billing/checkout').send({ type: 'pack', packId: 'pack_3' });
    expect(response.status).toBe(401);
  });
});
