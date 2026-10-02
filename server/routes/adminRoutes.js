const express = require('express');
const auth = require('../middleware/authMiddleware');
const { requireAdmin } = auth;
const { writeLimiter } = require('../middleware/rateLimits');
const admin = require('../controllers/adminController');

const router = express.Router();
router.use(auth, requireAdmin);
router.get('/stats', admin.getStats);
router.get('/users', admin.getUsers);
router.get('/payments', admin.getPayments);
router.patch('/users/:id/status', admin.updateUserStatus);
router.post('/users/:id/credits', admin.adjustCredits);
router.post('/users/:id/revoke-teacher', writeLimiter, admin.revokeTeacher);
router.post('/users/:id/payouts-block', writeLimiter, admin.setPayoutsBlocked);
router.delete('/reviews/:id', admin.deleteReview);

router.get('/teacher-applications', admin.getTeacherApplications);
router.post('/teacher-applications/:id/approve', writeLimiter, admin.approveTeacherApplication);
router.post('/teacher-applications/:id/reject', writeLimiter, admin.rejectTeacherApplication);

router.get('/payouts', admin.getPayouts);
router.post('/payouts/:id/approve', writeLimiter, admin.approvePayout);
router.post('/payouts/:id/reject', writeLimiter, admin.rejectPayout);
module.exports = router;
