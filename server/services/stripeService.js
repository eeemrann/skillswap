const Stripe = require('stripe');

let client = null;

/** Returns the Stripe client, or null when billing is not configured. */
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Test seam: swap in a fake client. */
function setStripeClient(fake) {
  client = fake;
}

module.exports = { getStripe, setStripeClient };
