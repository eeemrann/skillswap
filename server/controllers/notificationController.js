const mongoose = require('mongoose');
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Could not load notifications', error: error.message });
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
    res.status(500).json({ message: 'Could not load notification counts', error: error.message });
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
    res.status(400).json({ message: 'Could not update notification', error: error.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const filter = { userId: req.userId, read: false };
    if (req.body.type) filter.type = req.body.type;
    const result = await Notification.updateMany(filter, { read: true });
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ message: 'Could not update notifications', error: error.message });
  }
};
