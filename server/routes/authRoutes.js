const express = require('express');
const router = express.Router();
const { logout } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/logout', auth, logout);

module.exports = router;
