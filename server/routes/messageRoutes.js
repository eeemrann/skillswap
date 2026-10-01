const express = require('express');
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { getConversations, getMessages, sendMessage, getUnreadCount } = require('../controllers/messageController');

const router = express.Router();
router.get('/unread', auth, getUnreadCount);
router.get('/conversations', auth, getConversations);
router.get('/:userId', auth, getMessages);
router.post('/:userId', auth, writeLimiter, sendMessage);
module.exports = router;
