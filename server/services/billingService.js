const { User, Payment } = require('../models');
const { PLANS, findPack, CURRENCY } = require('../config/plans');
const { appUrl } = require('../config');
const { round2 } = require('../utils/money');
const { runInTransaction } = require('../utils/transaction');
const { grantCredits } = require('./creditService');
const { getStripe } = require('./stripeService');
const { queueEmail, createInAppNotification } = require('./notificationService');

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);
const isDuplicateKey = (error) => error && error.code === 11000;
const money = (cents) => `${(cents / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`;

/** Inserts the Payment first so a replayed webhook fails on the unique key before any credits move. */
async function recordPaymentAndGrant({ userId, payment, credits, ledgerType, description }) {
  try {
    await runInTransaction(async (session) => {
      await Payment.create([{ user: userId, ...payment, credits, description }], { session });
      if (credits > 0) await grantCredits(userId, credits, { type: ledgerType, description }, session);
    });
    return { duplicate: false };
  } catch (error) {
    if (isDuplicateKey(error)) return { duplicate: true };
    throw error;
  }
}

async function findUserForObject(object) {
  const userId = object?.metadata?.userId || object?.client_reference_id;
  if (userId) {
    const byId = await User.findById(userId).catch(() => null);
    if (byId) return byId;
  }
  const customerId = typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
  return customerId ? User.findOne({ stripeCustomerId: customerId }) : null;
}

/** One-off credit pack purchase, completed in Stripe Checkout. */
async function fulfilCreditPack(checkoutSession) {
  if (checkoutSession.payment_status !== 'paid') return { skipped: 'unpaid' };
  const pack = findPack(checkoutSession.metadata?.packId);
  const user = await findUserForObject(checkoutSession);
  if (!pack || !user) {
    console.error('Credit pack fulfilment skipped:', { sessionId: checkoutSession.id, pack: Boolean(pack), user: Boolean(user) });
    return { skipped: 'unknown' };
  }
  const result = await recordPaymentAndGrant({
    userId: user._id,
    payment: { kind: 'credit_pack', externalId: checkoutSession.id, amountCents: checkoutSession.amount_total ?? pack.priceCents, currency: checkoutSession.currency || CURRENCY },
    credits: pack.credits,
    ledgerType: 'purchase',
    description: `${pack.name} pack · ${pack.credits} credits`
  });
  if (!result.duplicate) {
    await Promise.all([
      createInAppNotification({ userId: user._id, type: 'billing', message: `${pack.credits} credits were added to your wallet`, relatedId: user._id }),
      queueEmail('CREDITS_PURCHASED', user.email, { credits: pack.credits, amount: money(checkoutSession.amount_total ?? pack.priceCents), url: `${appUrl()}/billing`, timezone: user.timezone })
    ]);
  }
  return result;
}

const subscriptionIdOfInvoice = (invoice) => {
  const value = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  return typeof value === 'string' ? value : value?.id;
};

const periodEndOf = (subscription) => {
  const seconds = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : undefined;
};

/** Mirrors a Stripe subscription onto the member (the only writer of plan fields). */
async function syncSubscription(subscription) {
  const user = await findUserForObject(subscription);
  if (!user) return null;
  const active = ACTIVE_STATUSES.has(subscription.status);
  const interval = subscription.metadata?.interval || subscription.items?.data?.[0]?.price?.recurring?.interval || user.planInterval;
  const update = active
    ? {
      plan: 'pro', planStatus: subscription.status, planInterval: interval === 'year' ? 'year' : 'month',
      currentPeriodEnd: periodEndOf(subscription), cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
      stripeSubscriptionId: subscription.id
    }
    : { plan: 'free', planStatus: subscription.status, planInterval: null, cancelAtPeriodEnd: false, $unset: { stripeSubscriptionId: 1, currentPeriodEnd: 1 } };
  const wasPro = user.plan === 'pro';
  await User.updateOne({ _id: user._id }, update);
  if (!wasPro && active) {
    await createInAppNotification({ userId: user._id, type: 'billing', message: 'Welcome to SkillSwap Pro', relatedId: user._id });
  } else if (wasPro && !active) {
    await createInAppNotification({ userId: user._id, type: 'billing', message: 'Your Pro subscription has ended', relatedId: user._id });
  }
  return user;
}

/** Monthly (or yearly, up front) Pro credit grant, driven by the paid invoice. */
async function fulfilSubscriptionInvoice(invoice) {
  const stripe = getStripe();
  const subscriptionId = subscriptionIdOfInvoice(invoice);
  if (!subscriptionId || invoice.status !== 'paid') return { skipped: 'not-a-paid-subscription-invoice' };
  const subscription = stripe ? await stripe.subscriptions.retrieve(subscriptionId) : null;
  const holder = subscription || { id: subscriptionId, customer: invoice.customer, metadata: invoice.subscription_details?.metadata || invoice.parent?.subscription_details?.metadata || {}, status: 'active' };
  const user = await syncSubscription(holder);
  if (!user) return { skipped: 'unknown-user' };

  const interval = holder.metadata?.interval === 'year' ? 'year' : 'month';
  const credits = round2(PLANS.pro.monthlyCredits * (interval === 'year' ? 12 : 1));
  const result = await recordPaymentAndGrant({
    userId: user._id,
    payment: { kind: 'subscription', externalId: invoice.id, amountCents: invoice.amount_paid ?? 0, currency: invoice.currency || CURRENCY, receiptUrl: invoice.hosted_invoice_url || '' },
    credits,
    ledgerType: 'subscription_grant',
    description: `Pro ${interval === 'year' ? 'annual' : 'monthly'} credits`
  });
  if (!result.duplicate) {
    await Promise.all([
      createInAppNotification({ userId: user._id, type: 'billing', message: `${credits} Pro credits were added to your wallet`, relatedId: user._id }),
      queueEmail('SUBSCRIPTION_RECEIPT', user.email, { credits, amount: money(invoice.amount_paid ?? 0), url: `${appUrl()}/billing`, timezone: user.timezone })
    ]);
  }
  return result;
}

async function handlePaymentFailed(invoice) {
  const user = await findUserForObject(invoice);
  if (user) {
    await createInAppNotification({ userId: user._id, type: 'billing', message: 'We could not charge your card for SkillSwap Pro. Please update your payment method.', relatedId: user._id });
  }
}

/** Entry point for verified Stripe webhook events. Unhandled types are acknowledged and ignored. */
async function processEvent(event) {
  const object = event.data?.object;
  switch (event.type) {
    case 'checkout.session.completed':
      return object.metadata?.kind === 'credit_pack' ? fulfilCreditPack(object) : { skipped: 'not-a-credit-pack' };
    case 'invoice.paid':
      return fulfilSubscriptionInvoice(object);
    case 'invoice.payment_failed':
      return handlePaymentFailed(object);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(object);
    default:
      return { skipped: event.type };
  }
}

module.exports = { processEvent, fulfilCreditPack, fulfilSubscriptionInvoice, syncSubscription, recordPaymentAndGrant };
