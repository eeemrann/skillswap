process.env.CLERK_TELEMETRY_DISABLED = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// The suites make far more requests from one address than a real client would.
process.env.API_RATE_LIMIT = '100000';
process.env.WRITE_RATE_LIMIT = '100000';
// Most payout tests exercise the automatic path; first-withdrawal review has its own tests.
process.env.PAYOUT_REVIEW_FIRST = 'false';
