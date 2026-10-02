jest.mock('@clerk/express', () => ({
  getAuth: (req) => ({ userId: req.headers['x-test-user'] || null }),
  clerkMiddleware: () => (req, res, next) => next(),
  clerkClient: { users: { getUser: jest.fn(), deleteUser: jest.fn().mockResolvedValue({}) } },
  verifyToken: jest.fn()
}));

const request = require('supertest');
const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser, makeTeacher, makeBooking, hoursFromNow } = require('./helpers/factories');
const { User, Booking, Transaction, Message, Review } = require('../models');
const app = require('../app');

jest.setTimeout(90000);
beforeAll(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await startDb();
});
afterAll(stopDb);
beforeEach(clearDb);

const as = (user) => ({
  get: (path) => request(app).get(path).set('x-test-user', user.clerkId),
  post: (path, body) => request(app).post(path).set('x-test-user', user.clerkId).send(body),
  put: (path, body) => request(app).put(path).set('x-test-user', user.clerkId).send(body),
  patch: (path, body) => request(app).patch(path).set('x-test-user', user.clerkId).send(body),
  del: (path) => request(app).delete(path).set('x-test-user', user.clerkId)
});
const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat], city: 'X', country: 'Y' });

describe('authentication', () => {
  test('protected routes reject anonymous callers', async () => {
    for (const path of ['/api/users', '/api/users/me', '/api/bookings', '/api/credits/history', '/api/matches', '/api/messages/conversations']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });

  test('admin routes reject ordinary members', async () => {
    const member = await makeUser();
    expect((await as(member).get('/api/admin/stats')).status).toBe(403);
  });

  test('unknown routes return a JSON 404', async () => {
    const response = await request(app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Route not found' });
  });

  test('malformed JSON is a 400, not a 500', async () => {
    const member = await makeUser();
    const response = await request(app).put('/api/users/me').set('x-test-user', member.clerkId).set('Content-Type', 'application/json').send('{bad');
    expect(response.status).toBe(400);
  });
});

describe('teacher directory', () => {
  test('lists verified teachers only, hiding the caller, suspended teachers and anyone not approved', async () => {
    const me = await makeTeacher({ name: 'Me' });
    await makeTeacher({ name: 'Visible' });
    await makeTeacher({ name: 'Suspended', status: 'suspended' });
    await makeTeacher({ name: 'NoSkills', skillsOffered: [] });
    await makeTeacher({ name: 'Pending', teacherStatus: 'pending' });
    await makeTeacher({ name: 'Revoked', teacherStatus: 'revoked' });
    await makeUser({ name: 'LegacyLearner', skillsOffered: ['React'] }); // old data: skills but never verified
    const response = await as(me).get('/api/users');
    expect(response.status).toBe(200);
    expect(response.body.map((user) => user.name)).toEqual(['Visible']);
    expect(response.headers['x-total-count']).toBe('1');
    expect(response.body[0].teacherProfile).toMatchObject({ headline: expect.any(String), hourlyRateCredits: 1, teacherType: 'industry_professional' });
  });

  test('never exposes email, balances, billing or exact coordinates', async () => {
    const me = await makeUser();
    await makeTeacher({ name: 'Private', location: point(90.4, 23.8), creditBalance: 99, earnedCredits: 40, plan: 'pro', planStatus: 'active', stripeCustomerId: 'cus_secret', stripeConnectId: 'acct_secret' });
    const [listed] = (await as(me).get('/api/users?lng=90.4&lat=23.8&radiusKm=50')).body;
    expect(listed.name).toBe('Private');
    expect(listed.location).toEqual({ city: 'X', country: 'Y' });
    expect(listed.distanceKm).toBe(0);
    expect(listed.isPro).toBe(true);
    expect(JSON.stringify(listed)).not.toMatch(/coordinates|email|creditBalance|earnedCredits|stripe|acct_|clerkId/i);
  });

  test('searches names, skills and headlines server-side, escaping regex characters', async () => {
    const me = await makeUser();
    await makeTeacher({ name: 'Ana', skillsOffered: ['Django'], verifiedSkills: ['Django'] });
    await makeTeacher({ name: 'Bo', skillsOffered: ['C++'], verifiedSkills: ['C++'], teacherProfile: { headline: 'Embedded systems veteran' } });
    expect((await as(me).get('/api/users?q=djan')).body.map((u) => u.name)).toEqual(['Ana']);
    expect((await as(me).get('/api/users?q=C%2B%2B')).body.map((u) => u.name)).toEqual(['Bo']);
    expect((await as(me).get('/api/users?q=embedded')).body.map((u) => u.name)).toEqual(['Bo']);
    expect((await as(me).get('/api/users?q=.*')).body).toEqual([]);
    expect((await as(me).get('/api/users?q[$ne]=x')).status).toBe(200);
  });

  test('filters by category, exact skill, qualification and maximum rate', async () => {
    const me = await makeUser();
    await makeTeacher({ name: 'Web', skillsOffered: ['React'], verifiedSkills: ['React'] });
    await makeTeacher({ name: 'Sec', skillsOffered: ['Ethical Hacking'], verifiedSkills: ['Ethical Hacking'], teacherProfile: { teacherType: 'university_lecturer', tier: 'expert', hourlyRateCredits: 4 } });
    const names = async (query) => (await as(me).get(`/api/users?${query}`)).body.map((u) => u.name).sort();
    expect(await names('category=security')).toEqual(['Sec']);
    expect(await names('category=web')).toEqual(['Web']);
    expect(await names('skill=ethical%20hacking')).toEqual(['Sec']);
    expect(await names('type=university_lecturer')).toEqual(['Sec']);
    expect(await names('maxRate=2')).toEqual(['Web']);
    expect(await names('maxRate=4')).toEqual(['Sec', 'Web']);
    expect(await names('category=nonsense')).toEqual(['Sec', 'Web']); // unknown filter values are ignored, not trusted
  });

  test('sorts by price or rating on request', async () => {
    const me = await makeUser();
    const cheap = await makeTeacher({ name: 'Cheap', teacherProfile: { hourlyRateCredits: 0.5 } });
    const pricey = await makeTeacher({ name: 'Pricey', teacherProfile: { tier: 'expert', hourlyRateCredits: 5 } });
    const learner = await makeUser();
    const done = await makeBooking(learner, pricey, { status: 'completed' });
    await Review.create({ booking: done._id, reviewer: learner._id, reviewee: pricey._id, rating: 5 });
    const order = async (sort) => (await as(me).get(`/api/users?sort=${sort}`)).body.map((u) => u.name);
    expect(await order('price_asc')).toEqual(['Cheap', 'Pricey']);
    expect(await order('price_desc')).toEqual(['Pricey', 'Cheap']);
    expect(await order('rating')).toEqual(['Pricey', 'Cheap']);
    expect(cheap).toBeTruthy();
  });

  test('respects the radius, orders Pro first then by distance, and paginates', async () => {
    const me = await makeUser();
    await makeTeacher({ name: 'Near', location: point(10.1, 10) });
    await makeTeacher({ name: 'Mid', location: point(10.3, 10) });
    await makeTeacher({ name: 'Far', location: point(30, 10) });
    await makeTeacher({ name: 'ProMid', location: point(10.35, 10), plan: 'pro', planStatus: 'active' });
    await makeTeacher({ name: 'CityOnly', location: { city: 'Somewhere', country: 'Z' } });

    const nearby = await as(me).get('/api/users?lng=10&lat=10&radiusKm=50');
    expect(nearby.body.map((u) => u.name)).toEqual(['ProMid', 'Near', 'Mid']);
    expect(nearby.headers['x-total-count']).toBe('3');
    expect((await as(me).get('/api/users?lng=10&lat=10&radiusKm=25')).body.map((u) => u.name)).toEqual(['Near']);
    expect((await as(me).get('/api/users?lng=10&lat=10&radiusKm=400')).body.map((u) => u.name)).toEqual(['ProMid', 'Near', 'Mid']);

    const worldwide = await as(me).get('/api/users?lng=10&lat=10&radiusKm=worldwide&limit=2&page=2');
    expect(worldwide.headers['x-total-count']).toBe('5');
    expect(worldwide.body).toHaveLength(2);
  });

  test('includes review summaries', async () => {
    const [me, teacher, other] = [await makeUser(), await makeTeacher({ name: 'Rated' }), await makeUser()];
    const booking = await makeBooking(other, teacher, { status: 'completed' });
    await Review.create({ booking: booking._id, reviewer: other._id, reviewee: teacher._id, rating: 4 });
    const rated = (await as(me).get('/api/users?q=Rated')).body[0];
    expect(rated).toMatchObject({ averageRating: 4, reviewCount: 1 });
  });
});

describe('profiles', () => {
  test('a teacher\'s public profile shows verified credentials and trust signals, never private data', async () => {
    const [viewer, teacher] = [await makeUser(), await makeTeacher({ location: point(1, 2), plan: 'pro', planStatus: 'active', earnedCredits: 12, stripeConnectId: 'acct_1' })];
    const done = await makeBooking(viewer, teacher, { status: 'completed' });
    const profile = (await as(viewer).get(`/api/users/${teacher._id}`)).body;
    expect(profile).toMatchObject({
      isPro: true, isTeacher: true, sessionsTaught: 1, sessionsLearned: 0, location: { city: 'X', country: 'Y' }, skillsOffered: ['React', 'Node.js'],
      teacher: { teacherType: 'industry_professional', tier: 'standard', hourlyRateCredits: 1, organization: 'Acme Corp', credentials: [{ kind: 'employment', title: 'Staff Engineer', issuer: 'Acme Corp' }] }
    });
    expect(JSON.stringify(profile)).not.toMatch(/coordinates|email|creditBalance|earnedCredits|stripe|acct_|clerkId/i);
    expect(done).toBeTruthy();
  });

  test('a learner\'s profile has no teacher section and lists no teaching skills', async () => {
    const [viewer, learner] = [await makeUser(), await makeUser({ skillsOffered: ['React'] })]; // legacy data must not leak as a verified skill
    const profile = (await as(viewer).get(`/api/users/${learner._id}`)).body;
    expect(profile).toMatchObject({ isTeacher: false, teacher: null, skillsOffered: [] });
  });

  test('suspended and unknown members are not found', async () => {
    const viewer = await makeUser();
    const banned = await makeUser({ status: 'suspended' });
    expect((await as(viewer).get(`/api/users/${banned._id}`)).status).toBe(404);
    expect((await as(viewer).get('/api/users/64b64b64b64b64b64b64b64b')).status).toBe(404);
  });

  test('my own profile includes spendable credits and plan limits, but no Stripe ids', async () => {
    const me = await makeTeacher({ creditBalance: 5, creditsHeld: 1.5, earnedCredits: 2, earnedUsed: 7, stripeCustomerId: 'cus_1', stripeConnectId: 'acct_1' });
    const profile = (await as(me).get('/api/users/me')).body;
    expect(profile).toMatchObject({ availableCredits: 3.5, earnedCredits: 2, effectivePlan: 'free', hasBilling: true, hasPayoutAccount: true, isTeacher: true, limits: { maxSessionMinutes: 60, serviceFeePct: 12 } });
    expect(profile.stripeCustomerId).toBeUndefined();
    expect(profile.stripeConnectId).toBeUndefined();
    expect(profile.earnedUsed).toBeUndefined();
  });

  test('updates the profile and validates availability and timezone', async () => {
    const me = await makeUser();
    const ok = await as(me).put('/api/users/me', {
      bio: '  Hello  ', timezone: 'Asia/Dhaka', skillsWanted: ['rust', 'Rust', ' kubernetes '], languages: ['English', 'Bangla'],
      availability: [{ day: 'monday', start: '09:00', end: '10:00' }], location: { city: 'Dhaka', country: 'Bangladesh' }
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ bio: 'Hello', timezone: 'Asia/Dhaka', skillsWanted: ['Rust', 'Kubernetes'], languages: ['English', 'Bangla'] });
    expect(ok.body.location).toMatchObject({ city: 'Dhaka' });
    expect(ok.body.location.coordinates).toBeUndefined();

    expect((await as(me).put('/api/users/me', { availability: [{ day: 'monday', start: '10:00', end: '09:00' }] })).status).toBe(400);
    expect((await as(me).put('/api/users/me', { availability: [{ day: 'funday', start: '09:00', end: '10:00' }] })).status).toBe(400);
    expect((await as(me).put('/api/users/me', { timezone: 'Mars/Base' })).body.timezone).toBe('UTC');
    expect((await as(me).put('/api/users/me', { location: { coordinates: [500, 500] } })).status).toBe(400);
  });

  test('only tech skills from the catalog can be learned', async () => {
    const me = await makeUser();
    const rejected = await as(me).put('/api/users/me', { skillsWanted: ['Rust', 'Watercolor painting'] });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toMatch(/tech skills only.*Watercolor painting/);
    expect((await User.findById(me._id)).skillsWanted).toEqual(['Python']);
  });

  test('teaching skills cannot be self-declared: learners are refused, teachers stay inside their verified skills', async () => {
    const learner = await makeUser();
    const refused = await as(learner).put('/api/users/me', { skillsOffered: ['React'] });
    expect(refused.status).toBe(403);
    expect((await as(learner).put('/api/users/me', { skillsOffered: [] })).status).toBe(200);

    const teacher = await makeTeacher();
    expect((await as(teacher).put('/api/users/me', { skillsOffered: ['React', 'Rust'] })).status).toBe(403);
    expect((await as(teacher).put('/api/users/me', { skillsOffered: ['react'] })).body.skillsOffered).toEqual(['React']);
    expect((await as(teacher).put('/api/users/me', { skillsOffered: [] })).status).toBe(400);
  });

  test('location is explicit: it can be set and removed, and the response never echoes coordinates', async () => {
    const me = await makeUser();
    const set = await as(me).patch('/api/users/me/location', { longitude: 90.4, latitude: 23.8 });
    expect(set.status).toBe(200);
    expect(JSON.stringify(set.body)).not.toContain('90.4');
    expect((await User.findById(me._id)).location.coordinates).toEqual([90.4, 23.8]);
    expect((await as(me).patch('/api/users/me/location', { longitude: 'x', latitude: 1 })).status).toBe(400);
    await as(me).del('/api/users/me/location');
    expect((await User.findById(me._id)).location).toBeUndefined();
  });
});

describe('bookings over HTTP', () => {
  const body = (teacher, extra = {}) => ({ providerId: String(teacher._id), skill: 'React', durationMinutes: 60, proposedTime: hoursFromNow(24).toISOString(), ...extra });

  test('booking a member who is not a verified teacher is refused', async () => {
    const [learner, impostor] = [await makeUser(), await makeUser({ skillsOffered: ['React'], teacherStatus: 'pending' })];
    const response = await as(learner).post('/api/bookings', body(impostor)).set('Idempotency-Key', 'abcdefgh-0');
    expect(response.status).toBe(403);
    expect(await Booking.countDocuments()).toBe(0);
  });

  test('request → accept → list → session access, hiding secrets along the way', async () => {
    const [learner, teacher] = [await makeUser(), await makeTeacher()];
    const created = await as(learner).post('/api/bookings', body(teacher)).set('Idempotency-Key', 'abcdefgh-1');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'pending', credits: 1 });
    expect(created.body.roomId).toBeUndefined();

    const replay = await as(learner).post('/api/bookings', body(teacher)).set('Idempotency-Key', 'abcdefgh-1');
    expect(replay.status).toBe(200);
    expect(replay.body._id).toBe(created.body._id);
    expect(await Booking.countDocuments()).toBe(1);

    const accepted = await as(teacher).patch(`/api/bookings/${created.body._id}/status`, { status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ status: 'accepted', escrow: 'held' });

    const list = (await as(learner).get('/api/bookings')).body;
    expect(list).toHaveLength(1);
    expect(list[0].provider.email).toBeUndefined();
    expect(list[0].roomId).toBeUndefined();
    expect(list[0]).toMatchObject({ joinOpensAt: expect.any(String), endsAt: expect.any(String) });

    // Session details: participants only, and no ICE credentials until the room is open.
    const early = (await as(learner).get(`/api/sessions/${created.body._id}`)).body;
    expect(early).toMatchObject({ access: { ok: false, code: 'TOO_EARLY' }, iceServers: [], booking: { role: 'learner' }, peer: { name: teacher.name } });
    expect((await as(await makeUser()).get(`/api/sessions/${created.body._id}`)).status).toBe(403);
    expect((await as(learner).get('/api/sessions/not-an-id')).status).toBe(400);
  });

  test('reports a payment-required error with a code the UI can act on', async () => {
    const [broke, teacher] = [await makeUser({ creditBalance: 0 }), await makeTeacher()];
    const response = await as(broke).post('/api/bookings', body(teacher)).set('Idempotency-Key', 'abcdefgh-2');
    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({ code: 'INSUFFICIENT_CREDITS', required: 1, available: 0 });
  });

  test('either member can cancel; the learner is refunded the reservation', async () => {
    const [learner, teacher] = [await makeUser(), await makeTeacher()];
    const { body: created } = await as(learner).post('/api/bookings', body(teacher)).set('Idempotency-Key', 'abcdefgh-3');
    await as(teacher).patch(`/api/bookings/${created._id}/status`, { status: 'accepted' });
    expect((await User.findById(learner._id)).creditsHeld).toBe(1);
    const cancelled = await as(teacher).patch(`/api/bookings/${created._id}/cancel`, { reason: 'Sick' });
    expect(cancelled.body).toMatchObject({ status: 'cancelled', escrow: 'released', cancelReason: 'Sick' });
    expect((await User.findById(learner._id)).creditsHeld).toBe(0);
  });

  test('confirming pays the teacher and appears in both ledgers from each point of view', async () => {
    const [learner, teacher] = [await makeUser(), await makeTeacher()];
    const booking = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(-2), status: 'accepted', escrow: 'held', roomId: 'd'.repeat(32) });
    await User.updateOne({ _id: learner._id }, { creditsHeld: 1 });
    const done = await as(learner).patch(`/api/bookings/${booking._id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.message).toMatch(/1 credit transferred/);

    expect((await as(learner).get('/api/credits/history')).body[0]).toMatchObject({ direction: 'out', amount: 1, counterpart: teacher.name });
    expect((await as(teacher).get('/api/credits/history')).body[0]).toMatchObject({ direction: 'in', amount: 0.88, fee: 0.12, counterpart: learner.name });
    expect(await Transaction.countDocuments()).toBe(1);

    const review = await as(learner).post('/api/reviews', { bookingId: String(booking._id), rating: 5, comment: 'Great' });
    expect(review.status).toBe(201);
    expect((await as(learner).post('/api/reviews', { bookingId: String(booking._id), rating: 5 })).status).toBe(409);
    expect((await as(teacher).post('/api/reviews', { bookingId: String(booking._id), rating: 6 })).status).toBe(400);
    expect((await as(teacher).post('/api/reviews', { bookingId: String(booking._id), rating: 4.5 })).status).toBe(400);
    expect((await as(await makeUser()).post('/api/reviews', { bookingId: String(booking._id), rating: 5 })).status).toBe(403);
  });
});

describe('messaging', () => {
  test('conversations list shows partners with last message and unread counts', async () => {
    const [learner, teacher, stranger] = [await makeUser(), await makeUser(), await makeUser()];
    await makeBooking(learner, teacher, { status: 'accepted', roomId: 'e'.repeat(32) });
    expect((await as(learner).post(`/api/messages/${stranger._id}`, { body: 'hi' })).status).toBe(403);
    await as(teacher).post(`/api/messages/${learner._id}`, { body: 'See you soon' });
    await as(teacher).post(`/api/messages/${learner._id}`, { body: 'Bring your guitar' });

    const [conversation] = (await as(learner).get('/api/messages/conversations')).body;
    expect(conversation).toMatchObject({ name: teacher.name, unread: 2, lastMessage: { body: 'Bring your guitar' } });
    expect((await as(learner).get('/api/messages/unread')).body).toEqual({ count: 2 });

    expect((await as(learner).get(`/api/messages/${teacher._id}`)).body).toHaveLength(2);
    expect((await as(learner).get('/api/messages/unread')).body).toEqual({ count: 0 });
    expect(await Message.countDocuments()).toBe(2);
    expect((await as(learner).post(`/api/messages/${teacher._id}`, { body: 'x'.repeat(2001) })).status).toBe(400);
  });
});

describe('account lifecycle', () => {
  test('exports the member\'s data', async () => {
    const me = await makeUser();
    const response = await as(me).get('/api/users/me/export');
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/skillswap-data\.json/);
    expect(response.body).toMatchObject({ profile: { email: me.email }, bookings: [], transactions: [] });
  });

  test('deletion is blocked by upcoming sessions, then anonymises the account', async () => {
    const [me, other] = [await makeUser(), await makeUser()];
    const live = await makeBooking(me, other, { status: 'accepted', roomId: 'f'.repeat(32) });
    expect((await as(me).del('/api/users/me')).status).toBe(409);
    await Booking.updateOne({ _id: live._id }, { status: 'cancelled' });
    await makeBooking(me, other, { proposedTime: hoursFromNow(50) });

    expect((await as(me).del('/api/users/me')).status).toBe(200);
    const gone = await User.findById(me._id);
    expect(gone).toMatchObject({ name: 'Deleted member', status: 'suspended', bio: '' });
    expect(gone.email).toMatch(/@deleted\.invalid$/);
    expect(gone.clerkId).toBeUndefined();
    expect(await Booking.countDocuments({ status: 'pending' })).toBe(0);
  });
});

describe('account deletion and earnings', () => {
  test('is refused while there are withdrawable earnings or a payout in flight, so no money is destroyed', async () => {
    const teacher = await makeTeacher({ creditBalance: 4, earnedCredits: 4 });
    const blocked = await as(teacher).del('/api/users/me');
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('EARNINGS_REMAIN');
    expect((await User.findById(teacher._id)).status).toBe('active');

    await User.updateOne({ _id: teacher._id }, { creditBalance: 0.5, earnedCredits: 0.5 }); // below the minimum payout: nothing to withdraw
    expect((await as(teacher).del('/api/users/me')).status).toBe(200);
    const gone = await User.findById(teacher._id);
    expect(gone).toMatchObject({ teacherStatus: 'none', verifiedSkills: [] });
    expect(gone.teacherProfile).toBeUndefined();
  });
});

describe('admin', () => {
  test('stats, user search, status changes and support credits', async () => {
    const admin = await makeUser({ role: 'admin', name: 'Boss' });
    const member = await makeUser({ name: 'Findable' });
    const stats = (await as(admin).get('/api/admin/stats')).body;
    expect(stats).toMatchObject({ users: 2, proUsers: 0, revenueTotalCents: 0, mrrCents: 0, teachers: 0, pendingApplications: 0, pendingPayouts: 0, payoutsPaidCents: 0, creditsOutstanding: 10 });

    expect((await as(admin).get('/api/admin/users?q=Findable')).body.map((u) => u.name)).toEqual(['Findable']);
    expect((await as(admin).patch(`/api/admin/users/${member._id}/status`, { status: 'suspended' })).body.status).toBe('suspended');
    expect((await as(admin).patch(`/api/admin/users/${admin._id}/status`, { status: 'suspended' })).status).toBe(400);

    const credit = await as(admin).post(`/api/admin/users/${member._id}/credits`, { amount: 2, reason: 'Goodwill' });
    expect(credit.status).toBe(200);
    expect(credit.body.creditBalance).toBe(7);
    expect(await Transaction.findOne({ to: member._id, type: 'adjustment' })).toMatchObject({ amount: 2 });
    expect((await as(admin).post(`/api/admin/users/${member._id}/credits`, { amount: 2 })).status).toBe(400);
    expect((await as(admin).post(`/api/admin/users/${member._id}/credits`, { amount: 5000, reason: 'x' })).status).toBe(400);
  });
});
