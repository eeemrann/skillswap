const { createBooking } = require('../controllers/bookingController');
const Booking = require('../models/Booking');
const bookingService = require('../services/bookingService');

jest.mock('../models/Booking');
jest.mock('../services/bookingService');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const USER = '68cbcf3dd72cfcb894f87a61';
const PROVIDER = '68cbcf3dd72cfcb894f87a62';
const inHours = (hours) => new Date(Date.now() + hours * 3600000);
const call = (body, { key = 'test-key-123', userId = USER } = {}) => {
  const res = response();
  return { res, promise: createBooking({ userId, get: () => key, body }, res) };
};

describe('bookingController.createBooking validation', () => {
  afterEach(() => jest.clearAllMocks());

  test.each([
    ['self-booking', { providerId: USER, skill: 'Guitar', proposedTime: inHours(24) }, 'You cannot book a session with yourself'],
    ['invalid provider id', { providerId: 'nope', skill: 'Guitar', proposedTime: inHours(24) }, 'Invalid provider id'],
    ['missing skill', { providerId: PROVIDER, skill: ' ', proposedTime: inHours(24) }, 'Choose a skill to learn'],
    ['unsupported duration', { providerId: PROVIDER, skill: 'Guitar', durationMinutes: 45, proposedTime: inHours(24) }, /Duration must be one of/],
    ['start in the past', { providerId: PROVIDER, skill: 'Guitar', proposedTime: inHours(-1) }, /at least 15 minutes/],
    ['start too soon', { providerId: PROVIDER, skill: 'Guitar', proposedTime: inHours(0.05) }, /at least 15 minutes/],
    ['start too far ahead', { providerId: PROVIDER, skill: 'Guitar', proposedTime: inHours(24 * 400) }, /up to 180 days/],
    ['unparseable time', { providerId: PROVIDER, skill: 'Guitar', proposedTime: 'soon' }, /at least 15 minutes/]
  ])('rejects %s with 400 before touching the database', async (_label, body, message) => {
    const { promise } = call(body);
    await expect(promise).rejects.toMatchObject({ status: 400, message: expect.stringMatching(message instanceof RegExp ? message : new RegExp(message)) });
    expect(Booking.findOne).not.toHaveBeenCalled();
    expect(bookingService.requestBooking).not.toHaveBeenCalled();
  });

  test('requires an Idempotency-Key header', async () => {
    const { promise } = call({ providerId: PROVIDER, skill: 'Guitar', proposedTime: inHours(24) }, { key: 'x' });
    await expect(promise).rejects.toMatchObject({ status: 400, message: 'A valid Idempotency-Key header is required' });
  });

  test('replays the stored booking for a reused idempotency key instead of creating another', async () => {
    Booking.findOne.mockResolvedValue({ toObject: () => ({ _id: 'b1', proposedTime: inHours(24), durationMinutes: 60, attendance: [] }) });
    const { res, promise } = call({ providerId: PROVIDER, skill: 'Guitar', proposedTime: inHours(24) });
    await promise;
    expect(bookingService.requestBooking).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ _id: 'b1' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  test('creates the booking and never leaks the room secret to clients', async () => {
    Booking.findOne.mockResolvedValue(null);
    bookingService.requestBooking.mockResolvedValue({ toObject: () => ({ _id: 'b2', roomId: 'secret', idempotencyKey: 'k', proposedTime: inHours(24), durationMinutes: 60, attendance: [] }) });
    const { res, promise } = call({ providerId: PROVIDER, skill: ' Guitar ', note: 'hi', durationMinutes: 60, proposedTime: inHours(24) });
    await promise;
    expect(bookingService.requestBooking).toHaveBeenCalledWith(expect.objectContaining({ requesterId: USER, providerId: PROVIDER, skill: 'Guitar', note: 'hi', durationMinutes: 60 }));
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.json.mock.calls[0][0];
    expect(sent.roomId).toBeUndefined();
    expect(sent.idempotencyKey).toBeUndefined();
    expect(sent).toMatchObject({ joinOpensAt: expect.any(Date), joinClosesAt: expect.any(Date) });
  });
});
