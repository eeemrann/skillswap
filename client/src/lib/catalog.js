/**
 * Offline copy of the server's plan catalog (server/config/plans.js), so the marketing pages render
 * instantly and survive an API outage. The server remains the source of truth for what is charged.
 */
export const FALLBACK_CATALOG = {
  currency: 'usd',
  signupCredits: 5,
  billingEnabled: true,
  economy: { creditValueCents: 1000, payoutCentsPerCredit: 800, minPayoutCents: 2000, payoutHoldDays: 3 },
  teacherRates: { min: 0.5, step: 0.25, default: 1, caps: { standard: 3, expert: 8 } },
  plans: [
    {
      id: 'free', name: 'Free', tagline: 'Learn from verified tech experts, pay per session', priceMonthlyCents: 0, priceYearlyCents: 0, monthlyCredits: 0, serviceFeePct: 12, maxActiveBookings: 3, maxSessionMinutes: 60,
      features: ['Live HD video sessions with verified experts', 'Up to 3 active bookings', 'Sessions up to 60 minutes', 'In-session chat & screen sharing', '12% platform fee on teaching earnings']
    },
    {
      id: 'pro', name: 'Pro', tagline: 'For people who learn or teach every week', priceMonthlyCents: 1900, priceYearlyCents: 19000, monthlyCredits: 1, serviceFeePct: 6, maxActiveBookings: 25, maxSessionMinutes: 240,
      features: ['1 bonus credit every month', 'Half the platform fee: 6% on teaching earnings', 'Up to 25 active bookings', 'Sessions up to 4 hours', 'Priority placement in Discover + Pro badge', 'Priority support']
    }
  ],
  packs: [
    { id: 'pack_5', name: 'Starter', credits: 5, priceCents: 5000 },
    { id: 'pack_15', name: 'Builder', credits: 15, priceCents: 13500, popular: true },
    { id: 'pack_40', name: 'Bootcamp', credits: 40, priceCents: 34000 }
  ]
};
