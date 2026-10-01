const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { getProfile, getPublicProfile, updateCoordinates, clearLocation, updateCompleteProfile, getAllUsers, exportData, deleteAccount } = require('../controllers/userController');

router.get('/', auth, getAllUsers);
router.get('/me', auth, getProfile);
router.put('/me', auth, writeLimiter, updateCompleteProfile);
router.patch('/me/location', auth, writeLimiter, updateCoordinates);
router.delete('/me/location', auth, writeLimiter, clearLocation);
router.get('/me/export', auth, exportData);
router.delete('/me', auth, writeLimiter, deleteAccount);
router.get('/:id', auth, getPublicProfile);

module.exports = router;
