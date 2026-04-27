const express = require('express');
const router = express.Router();
const internalAuth = require('../middlewares/internalAuth');
const holdController = require('../controllers/holdController');
const internalAccountController = require('../controllers/internalAccountController');

router.use(internalAuth);

// Holds
router.post('/holds', holdController.createHold);
router.get('/holds/:holdId', holdController.getHold);
router.post('/holds/:holdId/capture', holdController.captureHold);
router.post('/holds/:holdId/release', holdController.releaseHold);
router.patch('/holds/:holdId/reference', holdController.updateHoldReference);

// Accounts lookup
router.get('/accounts', internalAccountController.getAccountByUser);
router.get('/accounts/:sn/available-balance', internalAccountController.getAvailableBalanceEndpoint);

module.exports = router;
