const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { getAuth, clerkClient } = require('@clerk/express');

jest.mock('@clerk/express', () => ({
  getAuth: jest.fn(),
  clerkClient: {
    users: {
      getUser: jest.fn()
    }
  }
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

describe('auth middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    // Default mock for clerkClient.users.getUser
    clerkClient.users.getUser.mockResolvedValue({
      id: 'clerk_123',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User',
      imageUrl: 'https://example.com/avatar.png'
    });
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
    User.findOne.mockResolvedValue({
      _id: 'user-suspended',
      clerkId: 'clerk_suspended',
      status: 'suspended',
      role: 'user'
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'This account has been suspended' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches persisted role and user id for active users', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_active' });
    User.findOne.mockResolvedValue({
      _id: 'user-2',
      clerkId: 'clerk_active',
      status: 'active',
      role: 'admin'
    });

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('user-2');
    expect(req.userRole).toBe('admin');
    expect(req.clerkUserId).toBe('clerk_active');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('links an existing user by email if no clerkId is linked yet', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_new_link' });
    
    const existingUser = {
      _id: 'user-existing',
      email: 'test@example.com',
      status: 'active',
      role: 'user',
      save: jest.fn().mockResolvedValue(true)
    };

    // First call (by clerkId) returns null, second call (by email) returns existing user
    User.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);

    await authMiddleware(req, res, next);

    expect(existingUser.clerkId).toBe('clerk_new_link');
    expect(existingUser.authProvider).toBe('clerk');
    expect(existingUser.save).toHaveBeenCalled();
    expect(req.userId).toBe('user-existing');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('creates a new user when neither clerkId nor email exists', async () => {
    getAuth.mockReturnValue({ userId: 'clerk_brand_new' });

    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: 'user-new',
      clerkId: 'clerk_brand_new',
      status: 'active',
      role: 'user'
    });

    await authMiddleware(req, res, next);

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      clerkId: 'clerk_brand_new',
      email: 'test@example.com'
    }));
    expect(req.userId).toBe('user-new');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireAdmin middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  it('allows access for admin role', () => {
    req.userRole = 'admin';

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin role', () => {
    req.userRole = 'user';

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });
});