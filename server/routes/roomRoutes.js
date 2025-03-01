const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/rooms', verifyToken, roomController.getRooms);
router.post('/room/join', verifyToken, requireRole('member'), roomController.joinRoom);
router.get('/room/:id', verifyToken, requireRole('member'), roomController.getRoomById);
router.post('/room/insert', verifyToken, requireRole('member'), roomController.insertRoom);
router.post('/room/banInRoom', verifyToken, requireRole('admin'), roomController.getUserBanInRoom);
router.post('/room/banInGame', verifyToken, requireRole('admin'), roomController.getUserBanInGame);
router.post('/room/delInRoom', verifyToken, requireRole('admin'), roomController.getUserDelInRoom);
router.post('/room/delInGame', verifyToken, requireRole('admin'), roomController.getUserDelInGame);
router.patch('/room/updateRoom', verifyToken, requireRole('member'), roomController.updateRoomStatus);
router.patch('/room/updateCreator', verifyToken, requireRole('member'), roomController.updateCreator);
router.delete('/room/leave/:id', verifyToken, requireRole('member'), roomController.leaveRoom);
router.delete('/room/delete/:id', verifyToken, requireRole('member'), roomController.deleteRoom);

module.exports = router;