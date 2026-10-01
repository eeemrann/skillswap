const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { createInAppNotification } = require('../services/notificationService');
const { emitToUser } = require('../services/realtime');

async function areConnected(userId, otherUserId) {
  return Booking.exists({
    status: { $in: ['accepted', 'completed'] },
    $or: [
      { requester: userId, provider: otherUserId },
      { requester: otherUserId, provider: userId }
    ]
  });
}

/** People the member can message (shared accepted/completed booking), with last message and unread count. */
exports.getConversations = async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.userId);
  const bookings = await Booking.find({ status: { $in: ['accepted', 'completed'] }, $or: [{ requester: me }, { provider: me }] })
    .populate('requester', 'name profilePicture')
    .populate('provider', 'name profilePicture')
    .sort({ proposedTime: -1 })
    .limit(300);
  const partners = new Map();
  bookings.forEach((booking) => {
    const other = String(booking.requester._id) === req.userId ? booking.provider : booking.requester;
    if (other?._id && !partners.has(String(other._id))) {
      partners.set(String(other._id), { _id: other._id, name: other.name, profilePicture: other.profilePicture, skill: booking.skill });
    }
  });

  const summaries = await Message.aggregate([
    { $match: { $or: [{ sender: me }, { recipient: me }] } },
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: { $cond: [{ $eq: ['$sender', me] }, '$recipient', '$sender'] },
      last: { $first: { body: '$body', createdAt: '$createdAt', sender: '$sender' } },
      unread: { $sum: { $cond: [{ $and: [{ $eq: ['$recipient', me] }, { $eq: [{ $ifNull: ['$readAt', null] }, null] }] }, 1, 0] } }
    } }
  ]);
  const byPartner = new Map(summaries.map((item) => [String(item._id), item]));
  const conversations = [...partners.values()].map((partner) => {
    const summary = byPartner.get(String(partner._id));
    return { ...partner, lastMessage: summary?.last || null, unread: summary?.unread || 0 };
  }).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  res.json(conversations);
};

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
  const { bookingId } = req.body;
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) return res.status(400).json({ message: 'Message must be between 1 and 2000 characters' });
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
  const message = await Message.create({ sender: req.userId, recipient: req.params.userId, booking: bookingId, body });
  const sender = await User.findById(req.userId).select('name');
  await createInAppNotification({
    userId: req.params.userId,
    type: 'message',
    message: `${sender?.name || 'A SkillSwap member'} sent you a new message`,
    relatedId: message._id
  });
  emitToUser(req.params.userId, 'message:new', { from: req.userId });
  res.status(201).json(message);
};

exports.getUnreadCount = async (req, res) => {
  const count = await Message.countDocuments({ recipient: req.userId, readAt: null });
  res.json({ count });
};
