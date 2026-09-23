const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.post('/:id/start', campaignController.startCampaign);
router.post('/:id/stop', campaignController.stopCampaign);
router.get('/:id/status', campaignController.getCampaignStatus);
router.get('/:id/results', campaignController.getCampaignResults);
router.get('/:id/metrics', campaignController.getCampaignMetrics);

module.exports = router;
