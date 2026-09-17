const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getMatches } = require('../controllers/matchController');

router.get('/', auth, getMatches);

module.exports = router;