const { sendMessage } = require('../controllers/messageController');
const Booking = require('../models/Booking');

jest.mock('../models/Booking');
jest.mock('../models/Message', () => ({ create: jest.fn() }));

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('messageController.sendMessage validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rejects invalid recipient id', async () => {
    const req = {
      userId: '68cbcf3dd72cfcb894f87a61',
      params: { userId: 'not-an-id' },
      body: { body: 'Hello' }
    };
    const res = mockResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid user id' });
    expect(Booking.exists).not.toHaveBeenCalled();
  });

  test('rejects self messaging', async () => {
    const req = {
      userId: '68cbcf3dd72cfcb894f87a61',
      params: { userId: '68cbcf3dd72cfcb894f87a61' },
      body: { body: 'Hello' }
    };
    const res = mockResponse();

    await sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cannot message yourself' });
    expect(Booking.exists).not.toHaveBeenCalled();
  });
});
