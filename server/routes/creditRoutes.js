const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getHistory } = require('../controllers/creditController');

router.get('/history', auth, getHistory);

module.exports = router;