const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { login } = require('../controllers/authController');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../models/User');

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('local authentication', () => {
  afterEach(() => jest.clearAllMocks());

  test('allows an existing local account to sign in without email verification', async () => {
    const user = {
      _id: '68cbcf3dd72cfcb894f87a61',
      name: 'Member', email: 'member@example.com', password: 'hash',
      status: 'active', role: 'user', tokenVersion: 0
    };
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('signed-token');
    const res = response();

    await login({ body: { email: ' MEMBER@example.com ', password: 'password123' } }, res);

    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hash');
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'signed-token' }));
  });
});
