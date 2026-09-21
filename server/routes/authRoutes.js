const express = require('express');
const router = express.Router();
const { register, login, googleLogin, logout } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', auth, logout);

module.exports = router;
