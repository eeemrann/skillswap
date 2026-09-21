jest.mock('axios');
jest.mock('../models/Notification');
jest.mock('../models/EmailJob');

const axios = require('axios');
const Notification = require('../models/Notification');
const { notify, createInAppNotification } = require('../services/notificationService');

describe('notification service', () => {
  const originalUrl = process.env.NOTIFICATION_SERVICE_URL;
  const originalError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    process.env.NOTIFICATION_SERVICE_URL = 'https://notifications.example.com/';
  });

  afterAll(() => {
    console.error = originalError;
    process.env.NOTIFICATION_SERVICE_URL = originalUrl;
  });

  test('awaits and confirms email delivery', async () => {
    axios.post.mockResolvedValue({ data: { delivered: true } });
    const result = await notify('BOOKING_CREATED', 'member@example.com', { actor: 'Sam' });
    expect(axios.post).toHaveBeenCalledWith(
      'https://notifications.example.com/notify',
      expect.objectContaining({ recipientEmail: 'member@example.com' }),
      expect.objectContaining({ timeout: 10000, headers: expect.any(Object) })
    );
    expect(result.delivered).toBe(true);
  });

  test('logs provider failures without failing the booking action', async () => {
    axios.post.mockRejectedValue({ message: 'timeout', response: { status: 502, data: { message: 'SMTP rejected' } } });
    const result = await notify('BOOKING_CREATED', 'member@example.com', {});
    expect(result.delivered).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Email notification delivery failed:', expect.objectContaining({ detail: 'SMTP rejected' }));
  });

  test('persists an in-app notification', async () => {
    Notification.create.mockResolvedValue({ _id: 'notification-1' });
    await createInAppNotification({ userId: 'user-1', type: 'message', message: 'New message', relatedId: 'message-1' });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'message', message: 'New message' }));
  });
});
