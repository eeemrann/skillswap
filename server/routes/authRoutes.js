const express = require('express');
const router = express.Router();
const { googleLogin, logout } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/google', googleLogin);
router.post('/logout', auth, logout);

module.exports = router;
