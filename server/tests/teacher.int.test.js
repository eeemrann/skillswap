jest.mock('@clerk/express', () => ({
  getAuth: (req) => ({ userId: req.headers['x-test-user'] || null }),
  clerkMiddleware: () => (req, res, next) => next(),
  clerkClient: { users: { getUser: jest.fn(), deleteUser: jest.fn().mockResolvedValue({}) } },
  verifyToken: jest.fn()
}));

const request = require('supertest');
const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser, makeTeacher, makeBooking, makeApplication, applicationInput, hoursFromNow } = require('./helpers/factories');
const { User, Booking, TeacherApplication, TeacherEmailCheck, EmailJob, Notification } = require('../models');
const { requestBooking } = require('../services/bookingService');
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
  patch: (path, body) => request(app).patch(path).set('x-test-user', user.clerkId).send(body)
});

const pendingEmailCode = async (email) => {
  const job = await EmailJob.findOne({ type: 'TEACHER_EMAIL_CODE', recipientEmail: email }).sort({ createdAt: -1 });
  return job?.data?.code;
};

describe('applying to teach', () => {
  test('anonymous visitors cannot apply', async () => {
    expect((await request(app).put('/api/teachers/application').send(applicationInput())).status).toBe(401);
  });

  test('a valid application is queued for review, tells the admins, and is visible to the applicant without internal notes', async () => {
    const [applicant, admin] = [await makeUser(), await makeUser({ role: 'admin' })];
    const response = await as(applicant).put('/api/teachers/application', applicationInput());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'pending', skills: ['Go', 'System Design'], teacherType: 'university_lecturer' });

    expect((await User.findById(applicant._id)).teacherStatus).toBe('pending');
    expect(await Notification.countDocuments({ userId: admin._id, type: 'teacher' })).toBe(1);

    const mine = (await as(applicant).get('/api/teachers/me')).body;
    expect(mine.status).toBe('pending');
    expect(mine.application.reviewNotes).toBeUndefined();
    expect(mine.rules.categories.length).toBeGreaterThan(5);
    expect(mine.teaching).toBeNull();
  });

  test('an incomplete or non-tech application is refused and nothing is stored', async () => {
    const applicant = await makeUser();
    const response = await as(applicant).put('/api/teachers/application', applicationInput({ skills: ['Guitar'] }));
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/tech skills/);
    expect(await TeacherApplication.countDocuments()).toBe(0);
    expect((await User.findById(applicant._id)).teacherStatus).toBe('none');
  });

  test('re-submitting edits the same application instead of creating another', async () => {
    const applicant = await makeUser();
    await as(applicant).put('/api/teachers/application', applicationInput());
    await as(applicant).put('/api/teachers/application', applicationInput({ headline: 'Updated headline for my application' }));
    expect(await TeacherApplication.countDocuments()).toBe(1);
    expect((await TeacherApplication.findOne()).headline).toBe('Updated headline for my application');
  });
});

describe('proving a university or work email', () => {
  test('mails a one-time code, never returns it, and throttles repeat requests', async () => {
    const applicant = await makeUser();
    const sent = await as(applicant).post('/api/teachers/email/send', { email: 'Jane@Example.edu' });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ sent: true, academic: true });
    expect(JSON.stringify(sent.body)).not.toMatch(/\d{6}/);
    expect(await pendingEmailCode('jane@example.edu')).toMatch(/^\d{6}$/);
    expect((await as(applicant).post('/api/teachers/email/send', { email: 'jane@example.edu' })).status).toBe(429);
    expect((await as(applicant).post('/api/teachers/email/send', { email: 'nope' })).status).toBe(400);
  });

  test('the right code verifies the address and later applications carry the badge', async () => {
    const applicant = await makeUser();
    await as(applicant).post('/api/teachers/email/send', { email: 'jane@example.edu' });
    const code = await pendingEmailCode('jane@example.edu');

    expect((await as(applicant).post('/api/teachers/email/verify', { email: 'jane@example.edu', code: code === '000000' ? '111111' : '000000' })).status).toBe(400);
    const ok = await as(applicant).post('/api/teachers/email/verify', { email: 'jane@example.edu', code });
    expect(ok.body).toEqual({ verified: true, academic: true });

    const submitted = await as(applicant).put('/api/teachers/application', applicationInput({ institutionalEmail: 'jane@example.edu' }));
    expect(submitted.body.institutionalEmailVerified).toBe(true);
    const other = await as(applicant).put('/api/teachers/application', applicationInput({ institutionalEmail: 'someone@else.edu' }));
    expect(other.body.institutionalEmailVerified).toBe(false);
  });

  test('five wrong guesses lock the code, even if the next one is right', async () => {
    const applicant = await makeUser();
    await as(applicant).post('/api/teachers/email/send', { email: 'jane@example.edu' });
    const code = await pendingEmailCode('jane@example.edu');
    const wrong = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i += 1) expect((await as(applicant).post('/api/teachers/email/verify', { email: 'jane@example.edu', code: wrong })).status).toBe(400);
    expect((await as(applicant).post('/api/teachers/email/verify', { email: 'jane@example.edu', code })).status).toBe(429);
    expect((await TeacherEmailCheck.findOne()).verifiedAt).toBeUndefined();
  });

  test('a code only works for the member it was sent to, and expires', async () => {
    const [applicant, thief] = [await makeUser(), await makeUser()];
    await as(applicant).post('/api/teachers/email/send', { email: 'jane@example.edu' });
    const code = await pendingEmailCode('jane@example.edu');
    expect((await as(thief).post('/api/teachers/email/verify', { email: 'jane@example.edu', code })).status).toBe(400);

    await TeacherEmailCheck.updateOne({ user: applicant._id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await as(applicant).post('/api/teachers/email/verify', { email: 'jane@example.edu', code })).status).toBe(400);
  });
});

describe('administrator review', () => {
  const setup = async (overrides) => {
    const [admin, applicant] = [await makeUser({ role: 'admin' }), await makeUser()];
    const application = await makeApplication(applicant, overrides);
    await User.updateOne({ _id: applicant._id }, { teacherStatus: 'pending' });
    return { admin, applicant, application };
  };

  test('only administrators can see or decide applications', async () => {
    const { applicant, application } = await setup();
    expect((await as(applicant).get('/api/admin/teacher-applications')).status).toBe(403);
    expect((await as(applicant).post(`/api/admin/teacher-applications/${application._id}/approve`, {})).status).toBe(403);
    expect((await User.findById(applicant._id)).teacherStatus).toBe('pending');
  });

  test('the queue shows evidence signals to help the reviewer', async () => {
    const { admin, applicant } = await setup({ institutionalEmailVerified: true });
    const queue = (await as(admin).get('/api/admin/teacher-applications')).body;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      status: 'pending', user: { name: applicant.name, email: applicant.email },
      signals: { academicEmail: true, institutionalEmailVerified: true, verifiableCredentials: 1, linkHosts: expect.arrayContaining(['example.edu', 'linkedin.com']) }
    });
    expect((await as(admin).get('/api/admin/teacher-applications?status=approved')).body).toEqual([]);
  });

  test('approving makes the member a bookable verified teacher for the approved skills only', async () => {
    const { admin, applicant, application } = await setup();
    const response = await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { skills: ['go', 'Rust'], tier: 'standard', notes: 'Checked the faculty page' });
    expect(response.status).toBe(200);

    const teacher = await User.findById(applicant._id);
    expect(teacher).toMatchObject({ teacherStatus: 'approved', verifiedSkills: ['Go'], skillsOffered: ['Go'] }); // Rust was never requested
    expect(teacher.teacherProfile).toMatchObject({
      teacherType: 'university_lecturer', tier: 'standard', organization: 'Example University', hourlyRateCredits: 2, headline: expect.any(String),
      credentials: [{ kind: 'degree', title: 'PhD Computer Science', issuer: 'Example University', year: 2018 }]
    });
    expect(teacher.teacherProfile.credentials[0].url).toBeUndefined(); // verification links stay private
    expect(await TeacherApplication.findById(application._id)).toMatchObject({ status: 'approved', approvedSkills: ['Go'], reviewNotes: 'Checked the faculty page' });
    expect(await Notification.countDocuments({ userId: applicant._id, type: 'teacher' })).toBe(1);
    expect(await EmailJob.countDocuments({ type: 'TEACHER_APPROVED', recipientEmail: applicant.email })).toBe(1);
    expect((await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, {})).status).toBe(409);
  });

  test('the price follows the tier: standard teachers are capped at 3 credits an hour, experts can charge more', async () => {
    const { admin, application } = await setup({ proposedRateCredits: 6 });
    const standard = await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { tier: 'standard', rateCredits: 4 });
    expect(standard.status).toBe(400);
    expect(standard.body.message).toMatch(/between 0.5 and 3/);
    expect((await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { tier: 'nonsense' })).status).toBe(400);
    expect((await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { skills: ['Rust'] })).status).toBe(400);

    // Without an explicit rate a standard teacher's proposal is clamped to the cap.
    const clamped = await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { tier: 'standard' });
    expect(clamped.status).toBe(200);
    const [teacherDoc] = await User.find({ teacherStatus: 'approved' });
    expect(teacherDoc.teacherProfile.hourlyRateCredits).toBe(3);
  });

  test('an expert tier keeps the proposed rate', async () => {
    const { admin, applicant, application } = await setup({ proposedRateCredits: 6 });
    await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { tier: 'expert' });
    expect((await User.findById(applicant._id)).teacherProfile).toMatchObject({ tier: 'expert', hourlyRateCredits: 6 });
  });

  test('rejecting needs a reason, keeps the member a learner, and lets them fix and re-apply', async () => {
    const { admin, applicant, application } = await setup();
    expect((await as(admin).post(`/api/admin/teacher-applications/${application._id}/reject`, { reason: 'no' })).status).toBe(400);
    const rejected = await as(admin).post(`/api/admin/teacher-applications/${application._id}/reject`, { reason: 'Please link a page on your university site that lists you as staff.', notes: 'internal only' });
    expect(rejected.status).toBe(200);
    expect((await User.findById(applicant._id)).teacherStatus).toBe('rejected');
    expect((await EmailJob.findOne({ type: 'TEACHER_REJECTED' })).data.reason).toMatch(/university site/);

    const mine = (await as(applicant).get('/api/teachers/me')).body;
    expect(mine.status).toBe('rejected');
    expect(mine.application).toMatchObject({ status: 'rejected', decisionReason: expect.stringMatching(/university site/) });
    expect(mine.application.reviewNotes).toBeUndefined();

    const again = await as(applicant).put('/api/teachers/application', applicationInput());
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('pending');
    expect(again.body.decisionReason).toBe('');
    expect((await User.findById(applicant._id)).teacherStatus).toBe('pending');
    expect(await TeacherApplication.countDocuments()).toBe(1);
  });

  test('a verified teacher can ask for more skills without losing access; approval adds them and keeps the rate', async () => {
    const admin = await makeUser({ role: 'admin' });
    const teacher = await makeTeacher({ skillsOffered: ['React'], verifiedSkills: ['React'], teacherProfile: { hourlyRateCredits: 2.5 } });
    const response = await as(teacher).put('/api/teachers/application', applicationInput({ teacherType: 'industry_professional', skills: ['Docker', 'Kubernetes'] }));
    expect(response.status).toBe(200);
    expect((await User.findById(teacher._id)).teacherStatus).toBe('approved'); // still bookable while the request is reviewed

    const application = await TeacherApplication.findOne({ user: teacher._id });
    await as(admin).post(`/api/admin/teacher-applications/${application._id}/approve`, { skills: ['Docker'] });
    const fresh = await User.findById(teacher._id);
    expect(fresh.verifiedSkills.sort()).toEqual(['Docker', 'React']);
    expect(fresh.skillsOffered.sort()).toEqual(['Docker', 'React']);
    expect(fresh.teacherProfile.hourlyRateCredits).toBe(2.5);

    await expect(makeApplication(teacher)).rejects.toMatchObject({ code: 11000 }); // one application per member, enforced by a unique index
  });

  test('declining an extra-skills request does not remove a teacher who is already verified', async () => {
    const admin = await makeUser({ role: 'admin' });
    const teacher = await makeTeacher();
    await as(teacher).put('/api/teachers/application', applicationInput({ skills: ['Rust'] }));
    const application = await TeacherApplication.findOne({ user: teacher._id });
    await as(admin).post(`/api/admin/teacher-applications/${application._id}/reject`, { reason: 'We could not verify Rust experience yet.' });
    expect(await User.findById(teacher._id)).toMatchObject({ teacherStatus: 'approved', skillsOffered: ['React', 'Node.js'] });
  });

  test('revoking removes teaching access, cancels upcoming sessions and returns held credits', async () => {
    const admin = await makeUser({ role: 'admin' });
    const [teacher, learner] = [await makeTeacher(), await makeUser()];
    const upcoming = await makeBooking(learner, teacher, { status: 'accepted', escrow: 'held', roomId: 'a'.repeat(32), proposedTime: hoursFromNow(10) });
    const pending = await makeBooking(learner, teacher, { proposedTime: hoursFromNow(30) });
    await User.updateOne({ _id: learner._id }, { creditsHeld: 1 });
    await makeApplication(teacher);

    expect((await as(admin).post(`/api/admin/users/${teacher._id}/revoke-teacher`, { reason: 'x' })).status).toBe(400);
    const response = await as(admin).post(`/api/admin/users/${teacher._id}/revoke-teacher`, { reason: 'Credentials turned out to be misrepresented.' });
    expect(response.status).toBe(200);
    expect(response.body.cancelled).toBe(2);

    expect(await User.findById(teacher._id)).toMatchObject({ teacherStatus: 'revoked', skillsOffered: [] });
    expect((await Booking.findById(upcoming._id))).toMatchObject({ status: 'cancelled', escrow: 'released' });
    expect((await Booking.findById(pending._id)).status).toBe('cancelled');
    expect((await User.findById(learner._id)).creditsHeld).toBe(0);
    expect(await Notification.countDocuments({ userId: learner._id, type: 'booking' })).toBe(2);
    expect((await as(admin).post(`/api/admin/users/${teacher._id}/revoke-teacher`, { reason: 'Second attempt at it.' })).status).toBe(409);

    // And they disappear from Discover and cannot be booked.
    expect((await as(learner).get('/api/users')).body).toEqual([]);
    await expect(requestBooking({ requesterId: learner._id, providerId: teacher._id, skill: 'React', note: '', proposedTime: hoursFromNow(48), durationMinutes: 60, idempotencyKey: 'abcdefgh-9' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('teaching settings', () => {
  test('a verified teacher sets a price within their tier cap, and it applies to new bookings', async () => {
    const [teacher, learner] = [await makeTeacher(), await makeUser()];
    const ok = await as(teacher).patch('/api/teachers/me', { hourlyRateCredits: 2.5 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ hourlyRateCredits: 2.5, rateCap: 3, tier: 'standard', verifiedSkills: ['React', 'Node.js'] });

    const booking = await requestBooking({ requesterId: learner._id, providerId: teacher._id, skill: 'React', note: '', proposedTime: hoursFromNow(24), durationMinutes: 60, idempotencyKey: 'abcdefgh-1' });
    expect(booking).toMatchObject({ credits: 2.5, rateCredits: 2.5 });

    expect((await as(teacher).patch('/api/teachers/me', { hourlyRateCredits: 3.5 })).status).toBe(400);
    expect((await as(teacher).patch('/api/teachers/me', { hourlyRateCredits: 2.1 })).status).toBe(400);
    expect((await as(teacher).patch('/api/teachers/me', { hourlyRateCredits: 'free' })).status).toBe(400);
    // Raising the price later does not change what was already requested.
    await as(teacher).patch('/api/teachers/me', { hourlyRateCredits: 3 });
    expect((await Booking.findById(booking._id)).credits).toBe(2.5);
  });

  test('teachers can hide verified skills but never add unverified ones', async () => {
    const teacher = await makeTeacher();
    expect((await as(teacher).patch('/api/teachers/me', { skillsOffered: ['Node.js'] })).body.skillsOffered).toEqual(['Node.js']);
    expect((await as(teacher).patch('/api/teachers/me', { skillsOffered: ['react', 'Node.js'] })).body.skillsOffered).toEqual(['React', 'Node.js']);
    expect((await as(teacher).patch('/api/teachers/me', { skillsOffered: ['Rust'] })).status).toBe(403);
    expect((await as(teacher).patch('/api/teachers/me', { skillsOffered: [] })).status).toBe(400);
  });

  test('members who are not verified teachers cannot change teaching settings', async () => {
    for (const teacherStatus of ['none', 'pending', 'rejected', 'revoked']) {
      const member = await makeUser({ teacherStatus });
      expect((await as(member).patch('/api/teachers/me', { hourlyRateCredits: 2 })).status).toBe(403);
    }
  });
});

describe('public catalog', () => {
  test('lists the tech skills without needing to sign in', async () => {
    const response = await request(app).get('/api/catalog');
    expect(response.status).toBe(200);
    expect(response.body.categories.find((category) => category.id === 'security').skills).toContain('Penetration Testing');
    expect(response.body.teacherTypes).toHaveProperty('university_lecturer', 'University lecturer');
    expect(response.body.rates.caps).toEqual({ standard: 3, expert: 8 });
    expect(JSON.stringify(response.body)).not.toMatch(/Guitar|Yoga/);
  });
});
