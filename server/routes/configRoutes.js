const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/configs', verifyToken, configController.getConfigs);
router.patch('/config/update', verifyToken, requireRole('admin'), configController.updateConfig);

module.exports = router;