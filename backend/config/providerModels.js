/**
 * Target Model and AI Provider Configuration Registry
 * Defines supported providers, default target models, and valid model options per provider.
 */

const PROVIDER_MODELS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Verified / Recommended)' }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Free Tier)',
    defaultModel: 'google/gemini-2.0-flash-lite-preview-02-05:free',
    models: [
      { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (OpenRouter Free)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (OpenRouter Free)' }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7b 32768' }
    ]
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    defaultModel: 'llama3.2',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2 (Local)' },
      { id: 'mistral', name: 'Mistral 7B (Local)' },
      { id: 'custom-local-model', name: 'Custom Local Model' }
    ]
  },
  mock: {
    id: 'mock',
    name: 'Mock Fallback',
    defaultModel: 'gpt-4',
    models: [
      { id: 'gpt-4', name: 'GPT-4 (Mock Simulation)' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Mock Simulation)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Mock Simulation)' }
    ]
  }
};

function resolveModelForProvider(provider, modelId) {
  const pKey = (provider || 'gemini').toLowerCase();
  const pConfig = PROVIDER_MODELS[pKey] || PROVIDER_MODELS.gemini;

  if (!modelId) {
    return pConfig.defaultModel;
  }

  // If exact match in provider's registered models
  if (pConfig.models.some(m => m.id === modelId)) {
    return modelId;
  }

  // Provider-specific heuristics
  if (pKey === 'gemini') {
    if (modelId.toLowerCase().startsWith('gemini')) {
      return modelId;
    }
    console.warn(`[Provider Model Registry] Model '${modelId}' is not a valid Google Gemini REST model. Mapping to '${pConfig.defaultModel}' for Gemini provider.`);
    return pConfig.defaultModel;
  }

  if (pKey === 'openrouter') {
    if (modelId.includes('/') || modelId.includes(':free')) {
      return modelId;
    }
    return pConfig.defaultModel;
  }

  if (pKey === 'groq') {
    if (modelId.includes('llama') || modelId.includes('mixtral')) {
      return modelId;
    }
    return pConfig.defaultModel;
  }

  if (pKey === 'ollama') {
    return modelId || pConfig.defaultModel;
  }

  return modelId || pConfig.defaultModel;
}

module.exports = {
  PROVIDER_MODELS,
  resolveModelForProvider
};
