const { round2 } = require('../utils/money');

/**
 * Commercial configuration. Prices are in minor currency units (cents).
 * Everything that affects revenue lives here so it can be tuned in one place.
 *
 * Credits are the platform currency: learners buy them with money, spend them on live
 * sessions, and teachers cash earned credits out. 1 credit buys 1 hour at a 1.0x hourly rate.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Learn from verified tech experts, pay per session',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    monthlyCredits: 0,
    serviceFeePct: 12,
    maxActiveBookings: 3,
    maxSessionMinutes: 60,
    discoveryBoost: false,
    features: [
      'Live HD video sessions with verified experts',
      'Up to 3 active bookings',
      'Sessions up to 60 minutes',
      'In-session chat & screen sharing',
      '12% platform fee on teaching earnings'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For people who learn or teach every week',
    priceMonthlyCents: 1900,
    priceYearlyCents: 19000,
    monthlyCredits: 1,
    serviceFeePct: 6,
    maxActiveBookings: 25,
    maxSessionMinutes: 240,
    discoveryBoost: true,
    features: [
      '1 bonus credit every month',
      'Half the platform fee: 6% on teaching earnings',
      'Up to 25 active bookings',
      'Sessions up to 4 hours',
      'Priority placement in Discover + Pro badge',
      'Priority support'
    ]
  }
};

const CREDIT_PACKS = [
  { id: 'pack_5', name: 'Starter', credits: 5, priceCents: 5000 },
  { id: 'pack_15', name: 'Builder', credits: 15, priceCents: 13500, popular: true },
  { id: 'pack_40', name: 'Bootcamp', credits: 40, priceCents: 34000 }
];

const intFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
};

/**
 * Money <-> credit conversion. Learners pay `creditValueCents` per credit in the smallest pack
 * (bigger packs are cheaper). Teachers cash earned credits out at `payoutCentsPerCredit`; the
 * spread, plus the per-session platform fee, is what the platform keeps.
 */
const economy = () => ({
  creditValueCents: intFromEnv('CREDIT_VALUE_CENTS', 1000),
  payoutCentsPerCredit: intFromEnv('PAYOUT_CENTS_PER_CREDIT', 800),
  minPayoutCents: intFromEnv('MIN_PAYOUT_CENTS', 2000),
  /** Earnings become withdrawable this many days after the session settles (chargeback window). */
  payoutHoldDays: intFromEnv('PAYOUT_HOLD_DAYS', 3),
  /** Payouts above this amount wait for an administrator; smaller ones are sent automatically. */
  autoApprovePayoutCents: intFromEnv('PAYOUT_AUTO_APPROVE_CENTS', 25000),
  /** A teacher's very first withdrawal is always reviewed by a person, the best moment to catch fraud. */
  reviewFirstPayout: process.env.PAYOUT_REVIEW_FIRST !== 'false'
});

/** Teacher hourly rates are quoted in credits per hour and capped by verification tier. */
const TEACHER_RATES = {
  min: 0.5,
  step: 0.25,
  default: 1,
  caps: { standard: 3, expert: 8 }
};

const TEACHER_TYPES = {
  university_lecturer: 'University lecturer',
  industry_professional: 'Industry professional',
  certified_trainer: 'Certified trainer',
  independent_expert: 'Independent expert'
};

const TEACHER_TIERS = { standard: 'Verified', expert: 'Expert' };

const SESSION_DURATIONS = [30, 60, 90, 120, 180, 240];
const CURRENCY = (process.env.BILLING_CURRENCY || 'usd').toLowerCase();
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

const signupCredits = () => {
  const configured = Number(process.env.SIGNUP_CREDITS);
  return Number.isFinite(configured) && configured >= 0 ? round2(configured) : 5;
};

/** Effective plan for a user document. A lapsed subscription falls back to free. */
const planFor = (user) => (user && user.plan === 'pro' && PRO_STATUSES.has(user.planStatus || 'active') ? PLANS.pro : PLANS.free);

const rateCapFor = (tier) => TEACHER_RATES.caps[tier] || TEACHER_RATES.caps.standard;

/** True for a rate on the allowed grid (0.25 steps) within the tier's cap. */
const isValidRate = (rate, tier = 'standard') => {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < TEACHER_RATES.min || value > rateCapFor(tier)) return false;
  return Math.abs(value / TEACHER_RATES.step - Math.round(value / TEACHER_RATES.step)) < 1e-9;
};

/** Price of a session: the teacher's hourly rate (in credits) for the booked length. */
const creditsForDuration = (minutes, rate = 1) => round2((Number(minutes) / 60) * Number(rate));

const serviceFee = (credits, plan) => round2(credits * (plan.serviceFeePct / 100));

/** Cash value of credits at the payout rate, in cents. */
const payoutCents = (credits) => Math.round(Number(credits) * economy().payoutCentsPerCredit);

const findPack = (id) => CREDIT_PACKS.find((pack) => pack.id === id);

const publicCatalog = () => ({
  currency: CURRENCY,
  signupCredits: signupCredits(),
  plans: Object.values(PLANS),
  packs: CREDIT_PACKS,
  durations: SESSION_DURATIONS,
  economy: economy(),
  teacherRates: TEACHER_RATES,
  teacherTypes: TEACHER_TYPES
});

module.exports = {
  PLANS, CREDIT_PACKS, SESSION_DURATIONS, CURRENCY, TEACHER_RATES, TEACHER_TYPES, TEACHER_TIERS,
  economy, signupCredits, planFor, rateCapFor, isValidRate, creditsForDuration, serviceFee, payoutCents, findPack, publicCatalog
};
