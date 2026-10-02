const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getAuth, clerkClient } = require('@clerk/express');

jest.mock('@clerk/express', () => ({
  getAuth: jest.fn(),
  clerkClient: { users: { getUser: jest.fn() } }
}));
jest.mock('../models/User', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Transaction', () => ({ create: jest.fn() }));
jest.mock('../models/index', () => ({ User: require('../models/User'), Transaction: require('../models/Transaction') }));

const clerkProfile = (overrides = {}) => ({
  id: 'clerk_123',
  primaryEmailAddressId: 'email_1',
  emailAddresses: [{ id: 'email_1', emailAddress: 'Test@Example.com', verification: { status: 'verified' } }],
  firstName: 'Test',
  lastName: 'User',
  imageUrl: 'https://example.com/avatar.png',
  ...overrides
});

describe('auth middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    clerkClient.users.getUser.mockResolvedValue(clerkProfile());
    Transaction.create.mockResolvedValue({});
  });

  it('returns 401 when no Clerk userId is present in request', async () => {
    getAuth.mockReturnValue({ userId: null });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for suspended users with valid token', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_suspended' });
    User.findOne.mockResolvedValue({ _id: 'user-suspended', status: 'suspended', role: 'user' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'This account has been suspended' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user, persisted role and id for active users', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_active' });
    const user = { _id: 'user-2', status: 'active', role: 'admin' };
    User.findOne.mockResolvedValue(user);
    await authMiddleware(req, res, next);
    expect(req.user).toBe(user);
    expect(req.userId).toBe('user-2');
    expect(req.userRole).toBe('admin');
    expect(req.clerkUserId).toBe('clerk_active');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('links an existing user by email without granting a second welcome bonus', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_new_link' });
    User.findOne.mockResolvedValueOnce(null);
    User.findOneAndUpdate.mockResolvedValue({ value: { _id: 'user-existing', status: 'active', role: 'user' }, lastErrorObject: { updatedExisting: true } });

    await authMiddleware(req, res, next);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'test@example.com' },
      expect.objectContaining({ $set: { clerkId: 'clerk_new_link' } }),
      expect.objectContaining({ upsert: true, includeResultMetadata: true })
    );
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(req.userId).toBe('user-existing');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('creates a profile with welcome credits and records them in the ledger', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_brand_new' });
    User.findOne.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValue({ value: { _id: 'user-new', status: 'active', role: 'user' }, lastErrorObject: { upserted: 'user-new' } });

    await authMiddleware(req, res, next);

    const update = User.findOneAndUpdate.mock.calls[0][1];
    expect(update.$setOnInsert).toMatchObject({ email: 'test@example.com', name: 'Test User', creditBalance: 5 });
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup_bonus', to: 'user-new', amount: 5 }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not create a profile (or free credits) for an unverified email address', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_unverified' });
    User.findOne.mockResolvedValue(null);
    clerkClient.users.getUser.mockResolvedValue(clerkProfile({ emailAddresses: [{ id: 'email_1', emailAddress: 'a@b.co', verification: { status: 'unverified' } }] }));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }));
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to the existing record if two requests race to create the same profile', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_race' });
    const existing = { _id: 'user-race', status: 'active', role: 'user' };
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    User.findOneAndUpdate.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('user-race');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('answers 401 when the Clerk profile cannot be fetched', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_down' });
    User.findOne.mockResolvedValue(null);
    clerkClient.users.getUser.mockRejectedValue(new Error('network'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin middleware', () => {
  const run = (role) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    requireAdmin({ userRole: role }, res, next);
    return { res, next };
  };

  it('allows access for admin role', () => {
    const { res, next } = run('admin');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin role', () => {
    const { res, next } = run('user');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });
});
