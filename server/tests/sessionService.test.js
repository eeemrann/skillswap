const crypto = require('crypto');
const { evaluateAccess, buildIceServers, bothAttended, sessionWindow } = require('../services/sessionService');
const { planFor, creditsForDuration, serviceFee, PLANS, CREDIT_PACKS, signupCredits, economy, payoutCents, isValidRate } = require('../config/plans');
const { toUtcIntervals, availabilityOverlaps, tzOffsetMinutes } = require('../utils/availability');
const { round2 } = require('../utils/money');

const MIN = 60000;
const booking = (overrides = {}) => ({
  requester: 'learner', provider: 'teacher', status: 'accepted',
  proposedTime: new Date('2026-06-01T12:00:00Z'), durationMinutes: 60, attendance: [], ...overrides
});
const at = (iso) => new Date(iso);

describe('session access window', () => {
  test('opens 10 minutes before the start and closes 15 minutes after the end', () => {
    const { opensAt, closesAt, endsAt } = sessionWindow(booking());
    expect(opensAt).toEqual(at('2026-06-01T11:50:00Z'));
    expect(endsAt).toEqual(at('2026-06-01T13:00:00Z'));
    expect(closesAt).toEqual(at('2026-06-01T13:15:00Z'));
  });

  test.each([
    ['11:49', 'TOO_EARLY'],
    ['11:50', undefined],
    ['12:30', undefined],
    ['13:15', undefined],
    ['13:16', 'CLOSED']
  ])('at %s the answer is %s', (time, code) => {
    const result = evaluateAccess(booking(), 'learner', at(`2026-06-01T${time}:00Z`));
    expect(result.ok).toBe(code === undefined);
    expect(result.code).toBe(code);
  });

  test('only the two participants may enter', () => {
    expect(evaluateAccess(booking(), 'someone-else', at('2026-06-01T12:00:00Z'))).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(evaluateAccess(booking(), 'teacher', at('2026-06-01T12:00:00Z')).ok).toBe(true);
  });

  test('populated references work too', () => {
    const populated = booking({ requester: { _id: 'learner' }, provider: { _id: 'teacher' } });
    expect(evaluateAccess(populated, 'learner', at('2026-06-01T12:00:00Z')).ok).toBe(true);
  });

  test.each([
    ['pending', 'NOT_CONFIRMED'], ['completed', 'COMPLETED'], ['declined', 'UNAVAILABLE'], ['cancelled', 'UNAVAILABLE'], ['expired', 'UNAVAILABLE']
  ])('a %s booking is refused as %s', (status, code) => {
    expect(evaluateAccess(booking({ status }), 'learner', at('2026-06-01T12:00:00Z'))).toMatchObject({ ok: false, code });
  });

  test('the window honours environment overrides', () => {
    process.env.SESSION_JOIN_EARLY_MINUTES = '30';
    try {
      expect(sessionWindow(booking()).opensAt).toEqual(new Date(at('2026-06-01T12:00:00Z').getTime() - 30 * MIN));
    } finally {
      delete process.env.SESSION_JOIN_EARLY_MINUTES;
    }
  });
});

describe('attendance', () => {
  const entry = (user, totalSeconds) => ({ user, totalSeconds });
  test('a session counts as held only when both members stayed long enough', () => {
    expect(bothAttended(booking({ attendance: [entry('learner', 600), entry('teacher', 600)] }))).toBe(true);
    expect(bothAttended(booking({ attendance: [entry('learner', 600), entry('teacher', 30)] }))).toBe(false);
    expect(bothAttended(booking({ attendance: [entry('learner', 600)] }))).toBe(false);
    expect(bothAttended(booking())).toBe(false);
  });
});

describe('ICE servers', () => {
  const saved = { ...process.env };
  afterEach(() => {
    ['STUN_URLS', 'TURN_URLS', 'TURN_SECRET', 'TURN_USERNAME', 'TURN_CREDENTIAL'].forEach((key) => { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
  });

  test('defaults to public STUN only', () => {
    const servers = buildIceServers('user-1');
    expect(servers).toHaveLength(1);
    expect(servers[0].urls[0]).toMatch(/^stun:/);
  });

  test('issues short-lived TURN credentials signed with the shared secret (coturn REST scheme)', () => {
    process.env.TURN_URLS = 'turn:turn.example.com:3478, turns:turn.example.com:5349';
    process.env.TURN_SECRET = 'shhh';
    const now = Date.UTC(2026, 5, 1, 12, 0, 0);
    const turn = buildIceServers('user-1', now)[1];
    expect(turn.urls).toEqual(['turn:turn.example.com:3478', 'turns:turn.example.com:5349']);
    const expiry = Math.floor(now / 1000) + 6 * 3600;
    expect(turn.username).toBe(`${expiry}:user-1`);
    expect(turn.credential).toBe(crypto.createHmac('sha1', 'shhh').update(turn.username).digest('base64'));
  });

  test('supports a static TURN account', () => {
    process.env.TURN_URLS = 'turn:relay.example.com:443';
    process.env.TURN_USERNAME = 'user';
    process.env.TURN_CREDENTIAL = 'pass';
    expect(buildIceServers('u')[1]).toEqual({ urls: ['turn:relay.example.com:443'], username: 'user', credential: 'pass' });
  });

  test('never advertises TURN without credentials', () => {
    process.env.TURN_URLS = 'turn:relay.example.com:443';
    expect(buildIceServers('u')).toHaveLength(1);
  });
});

describe('plans and pricing', () => {
  test('a session costs the hourly rate of the teacher for the booked length', () => {
    expect([30, 60, 90, 120, 240].map((minutes) => creditsForDuration(minutes))).toEqual([0.5, 1, 1.5, 2, 4]);
    expect([30, 60, 90, 120].map((minutes) => creditsForDuration(minutes, 2.5))).toEqual([1.25, 2.5, 3.75, 5]);
    expect(creditsForDuration(90, 0.75)).toBe(1.13); // rounded to cents of a credit, never float noise
  });

  test('platform fee is 12% on Free and half of that on Pro, without float drift', () => {
    expect(serviceFee(1, PLANS.free)).toBe(0.12);
    expect(serviceFee(1.5, PLANS.free)).toBe(0.18);
    expect(serviceFee(0.5, PLANS.free)).toBe(0.06);
    expect(serviceFee(4, PLANS.pro)).toBe(0.24);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  test('past_due subscribers keep Pro while payment is retried; lapsed ones fall back to Free', () => {
    expect(planFor({ plan: 'pro', planStatus: 'active' }).id).toBe('pro');
    expect(planFor({ plan: 'pro', planStatus: 'trialing' }).id).toBe('pro');
    expect(planFor({ plan: 'pro', planStatus: 'past_due' }).id).toBe('pro');
    expect(planFor({ plan: 'pro', planStatus: 'canceled' }).id).toBe('free');
    expect(planFor({ plan: 'pro', planStatus: 'unpaid' }).id).toBe('free');
    expect(planFor({ plan: 'free' }).id).toBe('free');
    expect(planFor({}).id).toBe('free');
    expect(planFor(null).id).toBe('free');
  });

  test('every member starts with 5 free credits, configurable and sane', () => {
    expect(signupCredits()).toBe(5);
    process.env.SIGNUP_CREDITS = '8';
    expect(signupCredits()).toBe(8);
    process.env.SIGNUP_CREDITS = '-1';
    expect(signupCredits()).toBe(5);
    delete process.env.SIGNUP_CREDITS;
  });

  test('the platform keeps money on every pack, even when a teacher is paid out at full commission-free value', () => {
    const { payoutCentsPerCredit } = economy();
    CREDIT_PACKS.forEach((pack) => {
      const priceOfOneCredit = pack.priceCents / pack.credits;
      // A learner buys a credit, a Pro teacher (lowest fee) earns what is left of it and cashes it out.
      const cashPaidToTeacher = payoutCentsPerCredit * (1 - PLANS.pro.serviceFeePct / 100);
      expect(priceOfOneCredit).toBeGreaterThan(cashPaidToTeacher);
    });
    expect(CREDIT_PACKS.map((pack) => pack.priceCents / pack.credits)).toEqual([...CREDIT_PACKS.map((pack) => pack.priceCents / pack.credits)].sort((a, b) => b - a));
  });

  test('payout conversion rounds to whole cents and hourly rates stay on the allowed grid', () => {
    expect(payoutCents(2.5)).toBe(2000);
    expect(payoutCents(0.33)).toBe(264);
    expect(isValidRate(1)).toBe(true);
    expect(isValidRate(2.75)).toBe(true);
    expect(isValidRate(2.8)).toBe(false);
    expect(isValidRate(0.25)).toBe(false);
    expect(isValidRate(4)).toBe(false); // above the standard cap of 3
    expect(isValidRate(4, 'expert')).toBe(true);
    expect(isValidRate(9, 'expert')).toBe(false);
    expect(isValidRate('abc')).toBe(false);
  });

  test('Pro is genuinely better on every axis it advertises', () => {
    expect(PLANS.pro.serviceFeePct).toBeLessThan(PLANS.free.serviceFeePct);
    expect(PLANS.pro.maxActiveBookings).toBeGreaterThan(PLANS.free.maxActiveBookings);
    expect(PLANS.pro.maxSessionMinutes).toBeGreaterThan(PLANS.free.maxSessionMinutes);
    expect(PLANS.pro.priceYearlyCents).toBeLessThan(PLANS.pro.priceMonthlyCents * 12);
  });
});

describe('timezone-aware availability', () => {
  const winter = new Date('2026-01-15T12:00:00Z');
  const summer = new Date('2026-07-15T12:00:00Z');

  test('knows UTC offsets, including daylight saving', () => {
    expect(tzOffsetMinutes('UTC', winter)).toBe(0);
    expect(tzOffsetMinutes('America/New_York', winter)).toBe(-300);
    expect(tzOffsetMinutes('America/New_York', summer)).toBe(-240);
    expect(tzOffsetMinutes('Asia/Kolkata', winter)).toBe(330);
    expect(tzOffsetMinutes('Not/AZone', winter)).toBe(0);
  });

  test('converts a local slot to UTC minutes of the week', () => {
    // Monday 09:00 in Dhaka (UTC+6) is Monday 03:00 UTC = 180 minutes into the week.
    expect(toUtcIntervals([{ day: 'monday', start: '09:00', end: '10:00' }], 'Asia/Dhaka', winter)).toEqual([[180, 240]]);
  });

  test('wraps slots that cross the start of the week', () => {
    // Monday 01:00-03:00 in Dhaka is Sunday 19:00-21:00 UTC.
    const [slot] = toUtcIntervals([{ day: 'monday', start: '01:00', end: '03:00' }], 'Asia/Dhaka', winter);
    expect(slot).toEqual([6 * 1440 + 19 * 60, 6 * 1440 + 21 * 60]);
  });

  test('splits a slot that spans the week boundary', () => {
    const intervals = toUtcIntervals([{ day: 'sunday', start: '23:00', end: '23:59' }], 'Asia/Dhaka', winter);
    expect(intervals.length).toBeGreaterThanOrEqual(1);
    expect(intervals.every(([start, end]) => start >= 0 && end <= 7 * 1440 && start < end)).toBe(true);
  });

  test('detects overlap across zones and rejects near misses', () => {
    const dhaka = [{ day: 'monday', start: '09:00', end: '10:00' }];
    expect(availabilityOverlaps(dhaka, 'Asia/Dhaka', [{ day: 'sunday', start: '22:00', end: '23:30' }], 'America/New_York', winter)).toBe(true);
    expect(availabilityOverlaps(dhaka, 'Asia/Dhaka', [{ day: 'monday', start: '09:00', end: '10:00' }], 'America/New_York', winter)).toBe(false);
  });

  test('ignores malformed slots instead of throwing', () => {
    expect(toUtcIntervals([{ day: 'funday', start: '09:00', end: '10:00' }, { day: 'monday', start: '10:00', end: '09:00' }, null, {}], 'UTC')).toEqual([]);
    expect(availabilityOverlaps(undefined, 'UTC', undefined, 'UTC')).toBe(false);
  });
});
