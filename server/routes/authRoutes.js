const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verifyToken, verifyGuest } = require('../middleware/authMiddleware');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 30, // จำกัดการล็อกอินไม่เกิน 30 ครั้งต่อ IP
    message: 'คุณพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่อีกครั้งใน 15 นาที',
});

router.post('/auth/login', loginLimiter, authController.loginUser);
router.post('/auth/logout', verifyToken, authController.logoutUser);
router.get('/auth/checkRole', verifyGuest, authController.checkRole);

module.exports = router;
