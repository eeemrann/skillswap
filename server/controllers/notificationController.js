const mongoose = require('mongoose');
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json(notifications);
  } catch (error) {
    console.error('Notification list failed:', error.message);
    res.status(500).json({ message: 'Could not load notifications' });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    const grouped = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), read: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const counts = { all: 0, booking: 0, message: 0, review: 0, credit: 0 };
    grouped.forEach(({ _id, count }) => { counts[_id] = count; counts.all += count; });
    res.json(counts);
  } catch (error) {
    console.error('Notification count failed:', error.message);
    res.status(500).json({ message: 'Could not load notification counts' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: 'Could not update notification' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const filter = { userId: req.userId, read: false };
    if (req.body.type) filter.type = req.body.type;
    const result = await Notification.updateMany(filter, { read: true });
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ message: 'Could not update notifications' });
  }
};
