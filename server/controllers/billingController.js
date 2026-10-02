const { User, Payment } = require('../models');
const { PLANS, CURRENCY, publicCatalog, findPack } = require('../config/plans');
const { appUrl } = require('../config');
const { getStripe } = require('../services/stripeService');
const { processEvent } = require('../services/billingService');

const billingDisabled = (res) => res.status(503).json({ message: 'Billing is not available right now', code: 'BILLING_DISABLED' });

async function ensureCustomer(stripe, user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(user._id) } });
  await User.updateOne({ _id: user._id }, { stripeCustomerId: customer.id });
  return customer.id;
}

exports.getCatalog = (req, res) => res.json({ ...publicCatalog(), billingEnabled: Boolean(getStripe()) });

exports.createCheckout = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return billingDisabled(res);
  const { type, packId, interval } = req.body || {};
  const user = req.user;
  const base = appUrl();
  const common = {
    customer: await ensureCustomer(stripe, user),
    client_reference_id: String(user._id),
    allow_promotion_codes: true,
    success_url: `${base}/billing?status=success`,
    cancel_url: `${base}/billing?status=cancelled`,
    ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto', name: 'auto' } } : {})
  };

  let session;
  if (type === 'pack') {
    const pack = findPack(packId);
    if (!pack) return res.status(400).json({ message: 'Unknown credit pack' });
    session = await stripe.checkout.sessions.create({
      ...common,
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: { currency: CURRENCY, unit_amount: pack.priceCents, product_data: { name: `SkillSwap ${pack.name} pack`, description: `${pack.credits} credits for live 1:1 sessions with verified tech experts` } }
      }],
      metadata: { userId: String(user._id), kind: 'credit_pack', packId: pack.id }
    });
  } else if (type === 'subscription') {
    if (!['month', 'year'].includes(interval)) return res.status(400).json({ message: 'Choose monthly or yearly billing' });
    if (user.plan === 'pro' && user.stripeSubscriptionId) return res.status(409).json({ message: 'You already have an active subscription. Manage it from the billing portal.' });
    const pro = PLANS.pro;
    const metadata = { userId: String(user._id), kind: 'subscription', plan: 'pro', interval };
    session = await stripe.checkout.sessions.create({
      ...common,
      mode: 'subscription',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: interval === 'year' ? pro.priceYearlyCents : pro.priceMonthlyCents,
          recurring: { interval },
          product_data: { name: 'SkillSwap Pro', description: `${pro.monthlyCredits} credit per month, ${pro.serviceFeePct}% platform fee, priority placement` }
        }
      }],
      metadata,
      subscription_data: { metadata }
    });
  } else {
    return res.status(400).json({ message: 'Unknown checkout type' });
  }
  return res.json({ url: session.url });
};

exports.createPortal = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return billingDisabled(res);
  if (!req.user.stripeCustomerId) return res.status(400).json({ message: 'You have no billing history yet' });
  const session = await stripe.billingPortal.sessions.create({ customer: req.user.stripeCustomerId, return_url: `${appUrl()}/billing` });
  return res.json({ url: session.url });
};

exports.getPayments = async (req, res) => {
  const payments = await Payment.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50);
  res.json(payments);
};

/** Stripe webhook. Mounted with a raw body parser so the signature can be verified. */
exports.webhook = async (req, res) => {
  const stripe = getStripe();
  // Events about teachers' Connect accounts arrive on a second endpoint with its own signing secret.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
  if (!stripe || !secrets.length) return billingDisabled(res);
  let event;
  let lastError;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!event) {
    console.warn('Stripe webhook signature verification failed:', lastError?.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }
  try {
    await processEvent(event);
    return res.json({ received: true });
  } catch (error) {
    // A non-2xx response makes Stripe retry delivery, which is safe: fulfilment is idempotent.
    console.error('Stripe webhook processing failed:', { type: event.type, id: event.id, detail: error.message });
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};
