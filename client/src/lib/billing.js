import api from '../api/axios';

/** Creates a Stripe Checkout session and sends the browser there. */
export async function startCheckout(payload) {
  const { data } = await api.post('/billing/checkout', payload);
  window.location.assign(data.url);
}

export async function openBillingPortal() {
  const { data } = await api.post('/billing/portal');
  window.location.assign(data.url);
}

export const fetchCatalog = () => api.get('/billing/catalog').then((response) => response.data);

/** Price per credit, used to show the saving on bigger packs. */
export const perCredit = (pack) => pack.priceCents / pack.credits;

export const yearlySaving = (plan) => Math.max(0, Math.round((1 - plan.priceYearlyCents / (plan.priceMonthlyCents * 12)) * 100));
