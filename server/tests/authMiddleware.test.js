const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

jest.mock('jsonwebtoken');
jest.mock('../models/User');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('auth middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 403 for suspended users with valid token', async () => {
    const req = { headers: { authorization: { startsWith: () => true, split: () => ['Bearer', 'token'] } } };
    const res = mockResponse();
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: 'user-1', role: 'user' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user-1', role: 'user', status: 'suspended' }) });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'This account has been suspended' });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches persisted role and user id for active users', async () => {
    const req = { headers: { authorization: { startsWith: () => true, split: () => ['Bearer', 'token'] } } };
    const res = mockResponse();
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: 'user-2', role: 'user' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: { toString: () => 'user-2' }, role: 'admin', status: 'active' }) });

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('user-2');
    expect(req.userRole).toBe('admin');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
