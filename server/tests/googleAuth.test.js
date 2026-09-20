const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

jest.mock('jsonwebtoken');
jest.mock('../models/User', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));

const verifyIdToken = jest.fn();
OAuth2Client.mockImplementation(() => ({ verifyIdToken }));

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('Google authentication', () => {
  let googleLogin;

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.JWT_SECRET = 'test-secret';
    ({ googleLogin } = require('../controllers/authController'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.sign.mockReturnValue('skillswap-jwt');
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-123', email: 'new@example.com', email_verified: true, name: 'New User', picture: 'https://example.com/avatar.jpg' })
    });
  });

  test('creates and authenticates a new Google user', async () => {
    const createdUser = { _id: 'user-1', name: 'New User', email: 'new@example.com', role: 'user', profilePicture: 'https://example.com/avatar.jpg' };
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(createdUser);
    const res = response();

    await googleLogin({ body: { credential: 'google-id-token' } }, res);

    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'google-id-token', audience: 'google-client-id' });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', googleId: 'google-123', authProvider: 'google' }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'skillswap-jwt', user: expect.objectContaining({ id: 'user-1' }) }));
  });

  test('logs in and links an existing password user', async () => {
    const existingUser = { _id: 'user-2', name: 'Existing User', email: 'new@example.com', password: 'hash', role: 'user', status: 'active', save: jest.fn() };
    User.findOne.mockResolvedValue(existingUser);
    const res = response();

    await googleLogin({ body: { credential: 'google-id-token' } }, res);

    expect(User.create).not.toHaveBeenCalled();
    expect(existingUser.googleId).toBe('google-123');
    expect(existingUser.password).toBe('hash');
    expect(existingUser.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'skillswap-jwt' }));
  });
});
