/** Credits are decimal hours; keep them exact to two places. */
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** 1234 -> "12.34 USD", for emails and ledger descriptions. */
const formatCents = (cents, currency = 'usd') => `${(Number(cents) / 100).toFixed(2)} ${String(currency).toUpperCase()}`;

module.exports = { round2, formatCents };
