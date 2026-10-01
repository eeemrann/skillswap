/**
 * Offline copy of the server's plan catalog (server/config/plans.js), so the marketing pages render
 * instantly and survive an API outage. The server remains the source of truth for what is charged.
 */
export const FALLBACK_CATALOG = {
  currency: 'usd',
  signupCredits: 3,
  billingEnabled: true,
  plans: [
    {
      id: 'free', name: 'Free', tagline: 'Everything you need to start swapping', priceMonthlyCents: 0, priceYearlyCents: 0, monthlyCredits: 0, serviceFeePct: 10, maxActiveBookings: 3, maxSessionMinutes: 60,
      features: ['Live HD video sessions', 'Up to 3 active bookings', 'Sessions up to 60 minutes', 'In-session chat & screen sharing', '10% service fee on credits you earn']
    },
    {
      id: 'pro', name: 'Pro', tagline: 'For people who learn and teach every week', priceMonthlyCents: 1200, priceYearlyCents: 11900, monthlyCredits: 4, serviceFeePct: 0, maxActiveBookings: 25, maxSessionMinutes: 240,
      features: ['4 bonus credits every month', '0% service fee on credits you earn', 'Up to 25 active bookings', 'Sessions up to 4 hours', 'Priority placement in Discover + Pro badge', 'Priority support']
    }
  ],
  packs: [
    { id: 'pack_3', name: 'Starter', credits: 3, priceCents: 900 },
    { id: 'pack_10', name: 'Learner', credits: 10, priceCents: 2500, popular: true },
    { id: 'pack_25', name: 'Scholar', credits: 25, priceCents: 5500 }
  ]
};
