jest.mock('../models/User', () => ({
  findByIdAndUpdate: jest.fn()
}));
jest.mock('../models/Booking', () => ({}));
jest.mock('../models/Transaction', () => ({}));
jest.mock('../models/Review', () => ({}));

const User = require('../models/User');
const { updateUserStatus } = require('../controllers/adminController');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

describe('admin user moderation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('prevents an admin from suspending their own account', async () => {
    const req = { userId: 'admin-1', params: { id: 'admin-1' }, body: { status: 'suspended' } };
    const res = response();

    await updateUserStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Admins cannot suspend their own account.' });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
