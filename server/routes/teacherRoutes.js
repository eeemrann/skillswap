const express = require('express');
const auth = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimits');
const { getMine, submit, sendEmailCode, verifyEmailCode, updateTeaching } = require('../controllers/teacherController');

const router = express.Router();
router.use(auth);
router.get('/me', getMine);
router.put('/application', writeLimiter, submit);
router.post('/email/send', writeLimiter, sendEmailCode);
router.post('/email/verify', writeLimiter, verifyEmailCode);
router.patch('/me', writeLimiter, updateTeaching);

module.exports = router;
