const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.post('/otp/send', userController.sendOTP);
router.post('/otp/verify', userController.verifyForgotPasswordOTP);

router.patch('/password/reset', userController.resetPassword);
router.post('/password/forgot', userController.forgotPassword);
router.post('/password/newPassword', userController.newResetPassword);

router.post('/user/register', userController.registerUser);
router.post('/admin/register', userController.registerAdmin);
router.post('/user/checkUser', userController.checkUserExists);
router.post('/user/updateUnban', verifyToken, requireRole('member'), userController.updateUnban);
router.post('/member/updateUnbans', verifyToken, requireRole('admin'), userController.updateUnbans);

router.get('/admins', verifyToken, requireRole('admin'), userController.getAllAdmins);
router.get('/members', verifyToken, requireRole('admin'), userController.getAllMembers);
router.get('/user/id', verifyToken, requireRole('member'), userController.findUserById);
router.get('/user/ban', verifyToken, requireRole('member'), userController.getMemberBan);
router.get('/user/stat', verifyToken, requireRole('member'), userController.findUserStat);
router.get('/admin/profile', verifyToken, requireRole('admin'), userController.getAdminProfile);
router.get('/user/protectBan', verifyToken, requireRole('member'), userController.getProtectBan);
router.get('/user/leaderBoards', verifyToken, requireRole('member'), userController.getLeaderboards);

router.patch('/admin/updateUsage', verifyToken, requireRole('admin'), userController.updateUsage);
router.patch('/member/updateAdminBan', verifyToken, requireRole('admin'), userController.updateAdminBan);
router.patch('/user/updateProfile', verifyToken, requireRole('member'), userController.updateUserProfile);

router.delete('/admin/delete/:id', verifyToken, requireRole('admin'), userController.deleteAdmin)
router.delete('/member/delete/:id', verifyToken, requireRole('admin'), userController.deleteMember)

module.exports = router;
