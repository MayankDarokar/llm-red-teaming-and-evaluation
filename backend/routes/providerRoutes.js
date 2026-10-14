const express = require('express');
const router = express.Router();
const {
  getAllProvidersWithStatus,
  getModelsForProvider,
  getProviderStatus
} = require('../services/modelDiscoveryService');
const { isSupportedProvider, VALID_PROVIDERS } = require('../config/providerModels');

// GET /api/providers - List all supported providers and their configuration/availability status
router.get('/', async (req, res) => {
  try {
    const providers = await getAllProvidersWithStatus();
    res.json(providers);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve provider list: ${err.message}` });
  }
});

// GET /api/providers/:provider/models - Discover or retrieve available models for a provider
router.get('/:provider/models', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isSupportedProvider(provider)) {
      return res.status(400).json({
        error: `Unsupported provider '${provider}'. Supported: ${VALID_PROVIDERS.join(', ')}`
      });
    }

    const modelData = await getModelsForProvider(provider);
    res.json(modelData);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve models for provider: ${err.message}` });
  }
});

// GET /api/providers/:provider/status - Check provider readiness without generating text
router.get('/:provider/status', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isSupportedProvider(provider)) {
      return res.status(400).json({
        error: `Unsupported provider '${provider}'. Supported: ${VALID_PROVIDERS.join(', ')}`
      });
    }

    const status = await getProviderStatus(provider);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: `Failed to check provider status: ${err.message}` });
  }
});

module.exports = router;
