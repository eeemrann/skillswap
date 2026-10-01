const { round2 } = require('../utils/money');

/**
 * Commercial configuration. Prices are in minor currency units (cents).
 * Everything that affects revenue lives here so it can be tuned in one place.
 *
 * 1 credit = 1 hour of live video time.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Everything you need to start swapping',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    monthlyCredits: 0,
    serviceFeePct: 10,
    maxActiveBookings: 3,
    maxSessionMinutes: 60,
    discoveryBoost: false,
    features: [
      'Live HD video sessions',
      'Up to 3 active bookings',
      'Sessions up to 60 minutes',
      'In-session chat & screen sharing',
      '10% service fee on credits you earn'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For people who learn and teach every week',
    priceMonthlyCents: 1200,
    priceYearlyCents: 11900,
    monthlyCredits: 4,
    serviceFeePct: 0,
    maxActiveBookings: 25,
    maxSessionMinutes: 240,
    discoveryBoost: true,
    features: [
      '4 bonus credits every month',
      '0% service fee on credits you earn',
      'Up to 25 active bookings',
      'Sessions up to 4 hours',
      'Priority placement in Discover + Pro badge',
      'Priority support'
    ]
  }
};

const CREDIT_PACKS = [
  { id: 'pack_3', name: 'Starter', credits: 3, priceCents: 900 },
  { id: 'pack_10', name: 'Learner', credits: 10, priceCents: 2500, popular: true },
  { id: 'pack_25', name: 'Scholar', credits: 25, priceCents: 5500 }
];

const SESSION_DURATIONS = [30, 60, 90, 120, 180, 240];
const CURRENCY = (process.env.BILLING_CURRENCY || 'usd').toLowerCase();
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

const signupCredits = () => {
  const configured = Number(process.env.SIGNUP_CREDITS);
  return Number.isFinite(configured) && configured >= 0 ? round2(configured) : 3;
};

/** Effective plan for a user document. A lapsed subscription falls back to free. */
const planFor = (user) => (user && user.plan === 'pro' && PRO_STATUSES.has(user.planStatus || 'active') ? PLANS.pro : PLANS.free);

/** 1 credit buys 60 minutes. */
const creditsForDuration = (minutes) => round2(Number(minutes) / 60);

const serviceFee = (credits, plan) => round2(credits * (plan.serviceFeePct / 100));

const findPack = (id) => CREDIT_PACKS.find((pack) => pack.id === id);

const publicCatalog = () => ({
  currency: CURRENCY,
  signupCredits: signupCredits(),
  plans: Object.values(PLANS),
  packs: CREDIT_PACKS,
  durations: SESSION_DURATIONS
});

module.exports = { PLANS, CREDIT_PACKS, SESSION_DURATIONS, CURRENCY, signupCredits, planFor, creditsForDuration, serviceFee, findPack, publicCatalog };
