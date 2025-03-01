const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/game/count', verifyToken, requireRole('admin'), gameController.getGameCounts);
router.post('/game/insert', verifyToken, requireRole('member'), gameController.insertGame);

module.exports = router;