const rateLimit = require('express-rate-limit');

const json = (message) => ({ message });

/** Broad ceiling for every API call from one address. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests, please slow down')
});

/** Tighter ceiling for state-changing calls (bookings, messages, billing). */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.WRITE_RATE_LIMIT || 40),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many actions in a short time, please wait a moment')
});

module.exports = { apiLimiter, writeLimiter };
