const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '');

const configuredOrigins = () => (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || '')
  .split(',').map(normalizeOrigin).filter(Boolean);

/** Public URL of the web app; used in emails and Stripe redirects. */
const appUrl = () => normalizeOrigin(process.env.APP_URL || configuredOrigins()[0] || 'http://localhost:5173');

const intFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

module.exports = {
  normalizeOrigin,
  configuredOrigins,
  appUrl,
  /** Members may open the room this long before the scheduled start. */
  joinEarlyMinutes: () => intFromEnv('SESSION_JOIN_EARLY_MINUTES', 10),
  /** The room stays open this long after the scheduled end. */
  graceMinutes: () => intFromEnv('SESSION_GRACE_MINUTES', 15),
  /** Learners have this long to confirm a session before it settles automatically. */
  autoSettleHours: () => intFromEnv('SESSION_AUTO_SETTLE_HOURS', 24),
  /** Minimum time each member must have been in the room for a session to count as held. */
  minAttendanceSeconds: () => intFromEnv('SESSION_MIN_ATTENDANCE_SECONDS', 120)
};
