const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getProfile, updateSkills } = require('../controllers/userController');

router.get('/me', auth, getProfile);
router.put('/me/skills', auth, updateSkills);

module.exports = router;