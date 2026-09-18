const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');

const router = express.Router();
router.get('/unread', auth, getUnreadCount);
router.get('/:userId', auth, getMessages);
router.post('/:userId', auth, sendMessage);
module.exports = router;
