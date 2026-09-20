const { createBooking } = require('../controllers/bookingController');
const Booking = require('../models/Booking');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

jest.mock('../models/Booking');
jest.mock('../models/User');
jest.mock('../services/notificationService');

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('bookingController.createBooking', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects a self-booking attempt before querying the database', async () => {
    const userId = '68cbcf3dd72cfcb894f87a61';
    const res = response();
    await createBooking({ userId, body: { providerId: userId, skill: 'Guitar', proposedTime: new Date(Date.now() + 86400000) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'You cannot book a session with yourself' });
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('persists a request and waits for both in-app and email notification attempts', async () => {
    const requesterId = '68cbcf3dd72cfcb894f87a61';
    const providerId = '68cbcf3dd72cfcb894f87a62';
    const bookingId = '68cbcf3dd72cfcb894f87a63';
    const save = jest.fn().mockImplementation(function saveBooking() { this._id = bookingId; });
    Booking.mockImplementation((data) => ({ ...data, save }));
    User.findById
      .mockResolvedValueOnce({ _id: providerId, email: 'teacher@example.com', skillsOffered: ['Guitar'] })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ name: 'Learner', email: 'learner@example.com' }) });
    notificationService.notify.mockResolvedValue({ delivered: true });
    notificationService.createInAppNotification.mockResolvedValue({ _id: 'notification-id' });
    const res = response();

    await createBooking({ userId: requesterId, body: { providerId, skill: 'Guitar', proposedTime: new Date(Date.now() + 86400000) } }, res);

    expect(save).toHaveBeenCalled();
    expect(notificationService.createInAppNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: providerId, type: 'booking', relatedId: bookingId }));
    expect(notificationService.notify).toHaveBeenCalledWith('BOOKING_CREATED', 'teacher@example.com', expect.objectContaining({ actor: 'Learner' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
