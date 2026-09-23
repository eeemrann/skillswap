const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getProfile, getPublicProfile, updateSkills, updateCoordinates, updateProfile, updateCompleteProfile, getAllUsers } = require('../controllers/userController');

router.get('/', auth, getAllUsers);
router.get('/me', auth, getProfile);
router.put('/me/skills', auth, updateSkills);
router.patch('/me/location', auth, updateCoordinates);
router.put('/me/profile', auth, updateProfile);
router.put('/me', auth, updateCompleteProfile);
router.get('/:id', auth, getPublicProfile);

module.exports = router;
