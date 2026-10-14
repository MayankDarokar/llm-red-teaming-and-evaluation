/**
 * Model Discovery & Provider Readiness Service (Phase 3)
 * Provides safe, cached dynamic model discovery across supported AI providers:
 * - Google Gemini (via REST v1beta models endpoint)
 * - OpenRouter (via models catalogue endpoint)
 * - Groq (via OpenAI-compatible models endpoint)
 * - Ollama (via local tags endpoint)
 * - Mock (deterministic offline simulation)
 *
 * Guarantees:
 * - Bounded request timeouts (never hangs indefinitely)
 * - Short TTL in-memory caching to avoid rate-limiting
 * - Graceful fallback to verified registry defaults when discovery fails or key is missing
 * - Zero credentials logged or returned to client
 */

const { PROVIDER_MODELS, VALID_PROVIDERS } = require('../config/providerModels');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const modelCache = new Map();

function getCached(key) {
  const cached = modelCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  modelCache.set(key, { timestamp: Date.now(), data });
}

function clearCache() {
  modelCache.clear();
}

/**
 * Checks configuration and reachability status for a provider
 */
async function getProviderStatus(providerId) {
  const norm = (providerId || '').toLowerCase();
  const pConfig = PROVIDER_MODELS[norm];

  if (!pConfig) {
    return {
      provider: providerId,
      isConfigured: false,
      isAvailable: false,
      reason: `Unknown provider '${providerId}'. Supported: ${VALID_PROVIDERS.join(', ')}`
    };
  }

  if (norm === 'mock') {
    return {
      provider: 'mock',
      name: pConfig.name,
      executionMode: 'MOCK',
      isConfigured: true,
      isAvailable: true,
      defaultModel: pConfig.defaultModel
    };
  }

  if (norm === 'gemini') {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return {
      provider: 'gemini',
      name: pConfig.name,
      executionMode: 'EXTERNAL_API',
      isConfigured: hasKey,
      isAvailable: hasKey,
      defaultModel: pConfig.defaultModel,
      reason: hasKey ? null : 'GEMINI_API_KEY is not configured in backend environment.'
    };
  }

  if (norm === 'openrouter') {
    const hasKey = !!process.env.OPENROUTER_API_KEY;
    return {
      provider: 'openrouter',
      name: pConfig.name,
      executionMode: 'EXTERNAL_API',
      isConfigured: hasKey,
      isAvailable: hasKey,
      defaultModel: pConfig.defaultModel,
      reason: hasKey ? null : 'OPENROUTER_API_KEY is not configured in backend environment.'
    };
  }

  if (norm === 'groq') {
    const hasKey = !!process.env.GROQ_API_KEY;
    return {
      provider: 'groq',
      name: pConfig.name,
      executionMode: 'EXTERNAL_API',
      isConfigured: hasKey,
      isAvailable: hasKey,
      defaultModel: pConfig.defaultModel,
      reason: hasKey ? null : 'GROQ_API_KEY is not configured in backend environment.'
    };
  }

  if (norm === 'ollama') {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500)
      });
      const isOk = response.ok;
      return {
        provider: 'ollama',
        name: pConfig.name,
        executionMode: 'LOCAL',
        isConfigured: true,
        isAvailable: isOk,
        defaultModel: pConfig.defaultModel,
        reason: isOk ? null : `Ollama server returned HTTP ${response.status} at ${ollamaUrl}`
      };
    } catch (err) {
      return {
        provider: 'ollama',
        name: pConfig.name,
        executionMode: 'LOCAL',
        isConfigured: true,
        isAvailable: false,
        defaultModel: pConfig.defaultModel,
        reason: `Ollama is not running locally at ${ollamaUrl}. Start Ollama or select another provider.`
      };
    }
  }

  return {
    provider: norm,
    name: pConfig.name,
    isConfigured: false,
    isAvailable: false,
    reason: 'Unsupported provider'
  };
}

/**
 * Discovers available models for a provider, using bounded timeout & fallback to registry defaults
 */
async function getModelsForProvider(providerId) {
  const norm = (providerId || 'gemini').toLowerCase();
  const pConfig = PROVIDER_MODELS[norm] || PROVIDER_MODELS.gemini;
  const cacheKey = `models_${norm}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  // Fallback defaults from registry
  const fallbackResult = {
    provider: norm,
    defaultModel: pConfig.defaultModel,
    models: pConfig.models.map(m => ({ id: m.id, name: m.name, isDiscovered: false })),
    isDiscovered: false
  };

  try {
    // 1. Google Gemini Discovery
    if (norm === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        fallbackResult.reason = 'GEMINI_API_KEY is not configured.';
        return fallbackResult;
      }

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: cleanId,
              name: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
              isDiscovered: true
            };
          });

        if (models.length > 0) {
          // Sort to prioritize flash-lite and flash at the top
          models.sort((a, b) => {
            if (a.id === 'gemini-3.5-flash-lite') return -1;
            if (b.id === 'gemini-3.5-flash-lite') return 1;
            if (a.id === 'gemini-3.5-flash') return -1;
            if (b.id === 'gemini-3.5-flash') return 1;
            return a.id.localeCompare(b.id);
          });

          const res = {
            provider: 'gemini',
            defaultModel: 'gemini-3.5-flash-lite',
            models,
            isDiscovered: true
          };
          setCache(cacheKey, res);
          return res;
        }
      }
    }

    // 2. OpenRouter Discovery
    if (norm === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const headers = {
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'LLM Red-Teaming System'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(4500)
      });

      if (response.ok) {
        const data = await response.json();
        const rawList = data.data || [];
        
        // Prioritize free models (:free or zero cost)
        const freeModels = [];
        const otherModels = [];

        for (const m of rawList) {
          const isFree = m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0');
          const item = {
            id: m.id,
            name: `${m.name || m.id}${isFree ? ' [Free]' : ''}`,
            isDiscovered: true,
            isFree
          };
          if (isFree) {
            freeModels.push(item);
          } else if (otherModels.length < 25) {
            otherModels.push(item);
          }
        }

        const combined = [...freeModels, ...otherModels];
        if (combined.length > 0) {
          const defaultModel = freeModels[0]?.id || combined[0].id;
          const res = {
            provider: 'openrouter',
            defaultModel,
            models: combined,
            isDiscovered: true
          };
          setCache(cacheKey, res);
          return res;
        }
      }
    }

    // 3. Groq Discovery
    if (norm === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        fallbackResult.reason = 'GROQ_API_KEY is not configured.';
        return fallbackResult;
      }

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.data || [])
          .filter(m => !m.id.includes('whisper') && !m.id.includes('prompt-guard')) // Filter speech & guard models to keep completion LLMs
          .map(m => ({
            id: m.id,
            name: m.id,
            isDiscovered: true
          }));

        if (models.length > 0) {
          const defaultModel = models.some(m => m.id === 'llama-3.3-70b-versatile')
            ? 'llama-3.3-70b-versatile'
            : models[0].id;

          const res = {
            provider: 'groq',
            defaultModel,
            models,
            isDiscovered: true
          };
          setCache(cacheKey, res);
          return res;
        }
      }
    }

    // 4. Ollama Discovery (Local Installed Tags)
    if (norm === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500)
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map(m => {
          const sizeGB = m.size ? ` (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)` : '';
          return {
            id: m.name,
            name: `${m.name}${sizeGB}`,
            isDiscovered: true
          };
        });

        if (models.length > 0) {
          const res = {
            provider: 'ollama',
            defaultModel: models[0].id,
            models,
            isDiscovered: true
          };
          setCache(cacheKey, res);
          return res;
        }
      }
    }

    // 5. Mock Provider
    if (norm === 'mock') {
      return fallbackResult;
    }
  } catch (err) {
    console.warn(`[Model Discovery] Discovery failed for '${norm}': ${err.message}. Using verified static models.`);
    fallbackResult.reason = `Live discovery unavailable: ${err.message}`;
  }

  return fallbackResult;
}

/**
 * Returns comprehensive overview of all providers and their readiness status
 */
async function getAllProvidersWithStatus() {
  const statuses = await Promise.all(VALID_PROVIDERS.map(p => getProviderStatus(p)));
  return statuses;
}

module.exports = {
  getProviderStatus,
  getModelsForProvider,
  getAllProvidersWithStatus,
  clearCache
};
