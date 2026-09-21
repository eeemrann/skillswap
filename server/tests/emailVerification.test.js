const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { login, verifyEmail } = require('../controllers/authController');
const notificationService = require('../services/notificationService');

jest.mock('bcryptjs');
jest.mock('../models/User');
jest.mock('../services/notificationService', () => ({ queueEmail: jest.fn() }));

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('local email verification', () => {
  afterEach(() => jest.clearAllMocks());

  test('blocks a new unverified account after validating its password', async () => {
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ email: 'member@example.com', name: 'Member', password: 'hash', emailVerified: false, save: jest.fn() }) });
    bcrypt.compare.mockResolvedValue(true);
    notificationService.queueEmail.mockResolvedValue({ _id: 'email-job' });
    const res = response();
    await login({ body: { email: ' MEMBER@example.com ', password: 'password123' } }, res);
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hash');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresVerification: true, email: 'member@example.com' }));
    expect(notificationService.queueEmail).toHaveBeenCalledWith('EMAIL_VERIFICATION', 'member@example.com', expect.objectContaining({ code: expect.stringMatching(/^\d{6}$/) }));
  });

  test('verifies an unexpired six-digit code and removes the secret', async () => {
    const code = '123456';
    const user = {
      emailVerified: false,
      emailVerificationCodeHash: crypto.createHash('sha256').update(code).digest('hex'),
      emailVerificationExpires: new Date(Date.now() + 60000),
      save: jest.fn()
    };
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    const res = response();
    await verifyEmail({ body: { email: 'member@example.com', code } }, res);
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerificationCodeHash).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/verified successfully/i) }));
  });
});
