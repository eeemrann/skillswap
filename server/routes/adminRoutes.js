const express = require('express');
const auth = require('../middleware/authMiddleware');
const { requireAdmin } = auth;
const { getStats, getUsers, updateUserStatus, deleteReview } = require('../controllers/adminController');

const router = express.Router();
router.use(auth, requireAdmin);
router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/reviews/:id', deleteReview);
module.exports = router;
