const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createInAppNotification } = require('../services/notificationService');

async function areConnected(userId, otherUserId) {
  return Booking.exists({
    status: { $in: ['accepted', 'completed'] },
    $or: [
      { requester: userId, provider: otherUserId },
      { requester: otherUserId, provider: userId }
    ]
  });
}

exports.getMessages = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ message: 'Invalid user id' });
  if (req.userId === req.params.userId) return res.status(400).json({ message: 'Cannot message yourself' });
  if (!(await areConnected(req.userId, req.params.userId))) return res.status(403).json({ message: 'Messaging is available after an accepted booking' });
  const unread = await Message.find({ sender: req.params.userId, recipient: req.userId, readAt: null }).select('_id');
  const unreadIds = unread.map((item) => item._id);
  await Promise.all([
    Message.updateMany({ _id: { $in: unreadIds } }, { readAt: new Date() }),
    Notification.updateMany({ userId: req.userId, type: 'message', relatedId: { $in: unreadIds }, read: false }, { read: true })
  ]);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const messages = await Message.find({ $or: [{ sender: req.userId, recipient: req.params.userId }, { sender: req.params.userId, recipient: req.userId }] }).sort({ createdAt: -1 }).limit(limit);
  messages.reverse();
  res.json(messages);
};

exports.sendMessage = async (req, res) => {
  const { body, bookingId } = req.body;
  if (!body || !body.trim() || body.trim().length > 2000) return res.status(400).json({ message: 'Message must be between 1 and 2000 characters' });
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ message: 'Invalid user id' });
  if (req.userId === req.params.userId) return res.status(400).json({ message: 'Cannot message yourself' });
  if (!(await areConnected(req.userId, req.params.userId))) return res.status(403).json({ message: 'Messaging is available after an accepted booking' });
  if (bookingId) {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid booking id' });
    const linkedBooking = await Booking.findOne({
      _id: bookingId,
      status: { $in: ['accepted', 'completed'] },
      $or: [
        { requester: req.userId, provider: req.params.userId },
        { requester: req.params.userId, provider: req.userId }
      ]
    });
    if (!linkedBooking) return res.status(400).json({ message: 'Booking does not belong to this conversation' });
  }
  const message = await Message.create({ sender: req.userId, recipient: req.params.userId, booking: bookingId, body: body.trim() });
  const sender = await User.findById(req.userId).select('name');
  await createInAppNotification({
    userId: req.params.userId,
    type: 'message',
    message: `${sender?.name || 'A SkillSwap member'} sent you a new message`,
    relatedId: message._id
  });
  res.status(201).json(message);
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ recipient: req.userId, readAt: null });
    res.json({ count });
  } catch (err) {
    console.error('Unread message count failed:', err.message);
    res.status(500).json({ message: 'Unread count could not be loaded' });
  }
};
