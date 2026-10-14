/**
 * Target Model and AI Provider Configuration Registry
 * Defines supported providers, default target models, and valid model options per provider.
 */

const PROVIDER_MODELS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    executionMode: 'EXTERNAL_API',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Verified / Recommended)' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Fallback / Standard)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Free Tier)',
    executionMode: 'EXTERNAL_API',
    defaultModel: 'liquid/lfm-2.5-2.6b:free',
    models: [
      { id: 'liquid/lfm-2.5-2.6b:free', name: 'Liquid LFM 2.5 2.6B (OpenRouter Free)' },
      { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA Nemotron 3.5 Lightning (OpenRouter Free)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (OpenRouter Free)' },
      { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (OpenRouter Free)' }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    executionMode: 'EXTERNAL_API',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7b 32768' }
    ]
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    executionMode: 'LOCAL',
    defaultModel: 'llama3.2:3b',
    models: [
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B (Local)' },
      { id: 'llama3.2', name: 'Llama 3.2 (Local)' },
      { id: 'mistral', name: 'Mistral 7B (Local)' },
      { id: 'custom-local-model', name: 'Custom Local Model' }
    ]
  },
  mock: {
    id: 'mock',
    name: 'Mock Fallback',
    executionMode: 'MOCK',
    defaultModel: 'gpt-4',
    models: [
      { id: 'gpt-4', name: 'GPT-4 (Mock Simulation)' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Mock Simulation)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Mock Simulation)' }
    ]
  }
};

const VALID_PROVIDERS = ['gemini', 'openrouter', 'groq', 'ollama', 'mock'];

function isSupportedProvider(provider) {
  if (!provider || typeof provider !== 'string') return false;
  return VALID_PROVIDERS.includes(provider.toLowerCase());
}

function resolveProviderForModel(modelId) {
  if (!modelId) {
    return { provider: 'gemini', mode: 'EXTERNAL_API' };
  }

  const lower = String(modelId).toLowerCase();

  // Check mock models
  if (lower.includes('gpt-4') || lower.includes('claude')) {
    return { provider: 'mock', mode: 'MOCK' };
  }

  // Check OpenRouter (handles google/gemini-...:free and meta-llama/...:free)
  if (lower.includes('/') || lower.includes(':free')) {
    return { provider: 'openrouter', mode: 'EXTERNAL_API' };
  }

  // Check Groq
  if (lower.includes('mixtral') || lower.includes('llama-3.3-70b-versatile')) {
    return { provider: 'groq', mode: 'EXTERNAL_API' };
  }

  // Check Ollama
  if (lower.includes('llama3.2') || lower.includes('mistral') || lower.includes('custom-local')) {
    return { provider: 'ollama', mode: 'LOCAL' };
  }

  // Check Gemini
  if (lower.includes('gemini')) {
    return { provider: 'gemini', mode: 'EXTERNAL_API' };
  }

  return { provider: 'gemini', mode: 'EXTERNAL_API' };
}

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

  // Provider-specific heuristics to support discovered & custom models
  if (pKey === 'gemini') {
    if (modelId.toLowerCase().startsWith('gemini') || modelId.toLowerCase().startsWith('gemma') || modelId.toLowerCase().startsWith('nano')) {
      return modelId;
    }
    console.warn(`[Provider Model Registry] Model '${modelId}' is not a valid Google Gemini REST model. Mapping to '${pConfig.defaultModel}' for Gemini provider.`);
    return pConfig.defaultModel;
  }

  if (pKey === 'openrouter') {
    if (modelId.includes('/') || modelId.includes(':free')) {
      return modelId;
    }
    return modelId || pConfig.defaultModel;
  }

  if (pKey === 'groq') {
    if (modelId && typeof modelId === 'string' && modelId.trim()) {
      return modelId.trim();
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
  VALID_PROVIDERS,
  isSupportedProvider,
  resolveModelForProvider,
  resolveProviderForModel
};

