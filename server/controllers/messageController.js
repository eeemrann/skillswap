const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const User = require('../models/User');
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
  await Message.updateMany({ sender: req.params.userId, recipient: req.userId, readAt: null }, { readAt: new Date() });
  const messages = await Message.find({ $or: [{ sender: req.userId, recipient: req.params.userId }, { sender: req.params.userId, recipient: req.userId }] }).sort({ createdAt: 1 });
  res.json(messages);
};

exports.sendMessage = async (req, res) => {
  const { body, bookingId } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ message: 'Message cannot be empty' });
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) return res.status(400).json({ message: 'Invalid user id' });
  if (req.userId === req.params.userId) return res.status(400).json({ message: 'Cannot message yourself' });
  if (!(await areConnected(req.userId, req.params.userId))) return res.status(403).json({ message: 'Messaging is available after an accepted booking' });
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
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
