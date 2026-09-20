const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getNotifications,
  getUnreadCounts,
  markNotificationRead,
  markNotificationsRead
} = require('../controllers/notificationController');

const router = express.Router();
router.use(auth);
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCounts);
router.patch('/read', markNotificationsRead);
router.patch('/:id/read', markNotificationRead);

module.exports = router;
