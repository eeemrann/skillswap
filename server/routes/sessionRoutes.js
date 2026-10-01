const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getSession } = require('../controllers/sessionController');

router.get('/:bookingId', auth, getSession);

module.exports = router;
