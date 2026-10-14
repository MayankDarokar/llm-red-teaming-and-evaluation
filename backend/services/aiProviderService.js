/**
 * AI Provider Abstraction Layer (Phase 2)
 * Supports Google Gemini, OpenRouter (free tier), Groq, Ollama (local), and Mock Fallback.
 * Guaranteed $0 cost operation with graceful fallback chain & automatic 503 model failover.
 */

const { resolveModelForProvider, isSupportedProvider, VALID_PROVIDERS } = require('../config/providerModels');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeError(errorOrMessage, sensitiveValues = []) {
  if (!errorOrMessage) return '';
  let str = typeof errorOrMessage === 'string' ? errorOrMessage : (errorOrMessage.message || String(errorOrMessage));
  for (const val of sensitiveValues) {
    if (val && typeof val === 'string' && val.length > 3) {
      str = str.split(val).join('[REDACTED]');
    }
  }
  str = str.replace(/key=[A-Za-z0-9_.-]+/gi, 'key=[REDACTED]');
  str = str.replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED]');
  str = str.replace(/x-goog-api-key[:=]\s*[A-Za-z0-9_.-]+/gi, 'x-goog-api-key: [REDACTED]');
  return str;
}

function isRetryableGeminiStatus(status) {
  // Retryable statuses: Rate limit (429), Service Unavailable (503), Bad Gateway (502), Gateway Timeout (504), Server Error (500)
  return status === 429 || status === 503 || status === 502 || status === 504 || status === 500;
}

async function generateCompletion({
  provider = 'gemini',
  mode = 'EXTERNAL_API',
  systemPrompt = '',
  userPrompt = '',
  model = '',
  temperature = 0.7
}) {
  const normProvider = (provider || 'gemini').toLowerCase();
  console.log(`[AI Provider Call] Requesting provider: '${normProvider}', mode: '${mode}', model: '${model || '(default)'}'`);

  if (!isSupportedProvider(normProvider)) {
    throw new Error(`Unsupported AI provider '${provider}'. Supported providers are: ${VALID_PROVIDERS.join(', ')}`);
  }

  // If explicitly set to MOCK mode, execute deterministic mock simulation
  if (mode === 'MOCK' || normProvider === 'mock') {
    const resolvedModel = resolveModelForProvider('mock', model);
    console.log(`[AI Provider Result] Executing intentional MOCK mode for model '${resolvedModel}'`);
    return {
      text: null,
      providerUsed: 'mock',
      modeUsed: 'MOCK',
      isMock: true,
      modelUsed: resolvedModel
    };
  }

  // 1. Handle LOCAL mode (Ollama)
  if (mode === 'LOCAL' || normProvider === 'ollama') {
    const selectedModel = resolveModelForProvider('ollama', model);
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: { temperature }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          console.log(`[AI Provider Result] SUCCESS via Ollama (Model: '${selectedModel}', Mode: LOCAL, isMock: false)`);
          return {
            text: data.response,
            providerUsed: 'ollama',
            modeUsed: 'LOCAL',
            isMock: false,
            modelUsed: selectedModel
          };
        }
      }
      const errText = await response.text();
      if (response.status === 404) {
        throw new Error(`Ollama returned HTTP status 404: Model '${selectedModel}' not found. Please install it with 'ollama pull ${selectedModel}' or select an installed model.`);
      }
      throw new Error(`Ollama returned HTTP status ${response.status}: ${errText}`);
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        throw new Error(`Provider 'ollama' request timed out after 30s at ${ollamaUrl}.`);
      }
      if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
        throw new Error(`Provider 'ollama' request failed: Ollama is not running locally at ${ollamaUrl}. Please start Ollama or select another provider.`);
      }
      throw new Error(`Provider 'ollama' request failed at ${ollamaUrl}: ${err.message}`);
    }
  }

  // 2. Handle EXTERNAL_API mode: Gemini (with multi-model candidate failover)
  if (normProvider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Provider 'gemini' is not configured: GEMINI_API_KEY is missing in backend environment.");
    }

    const primaryModel = resolveModelForProvider('gemini', model);
    const candidates = [primaryModel];
    if (primaryModel === 'gemini-3.5-flash-lite') {
      candidates.push('gemini-3.5-flash');
    }
    const geminiModelCandidates = Array.from(new Set(candidates));
    const attemptErrors = [];

    for (let i = 0; i < geminiModelCandidates.length; i++) {
      const geminiModel = geminiModelCandidates[i];
      const isFallback = i > 0;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

        const contents = [];
        if (systemPrompt) {
          contents.push({ role: 'user', parts: [{ text: `[System Instructions]\n${systemPrompt}` }] });
          contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: userPrompt }] });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature }
          }),
          signal: AbortSignal.timeout(25000)
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            console.log(`[AI Provider Result] SUCCESS via Google Gemini (Model: '${geminiModel}', Mode: EXTERNAL_API, isMock: false${isFallback ? ', fallback: true' : ''})`);
            return {
              text: reply,
              providerUsed: 'gemini',
              modeUsed: 'EXTERNAL_API',
              isMock: false,
              modelUsed: geminiModel
            };
          }
          const emptyMsg = `Gemini model '${geminiModel}' returned empty content parts.`;
          attemptErrors.push({ model: geminiModel, status: response.status, message: emptyMsg });
          console.warn(`[AI Provider Error] ${emptyMsg}`);
        } else {
          const rawErrText = await response.text();
          const cleanErrText = sanitizeError(rawErrText, [apiKey]).trim() || response.statusText || 'Request failed';
          const isRetryable = isRetryableGeminiStatus(response.status);

          attemptErrors.push({
            model: geminiModel,
            status: response.status,
            message: cleanErrText
          });

          console.warn(`[AI Provider Error] Gemini model '${geminiModel}' returned HTTP status ${response.status}: ${cleanErrText}`);

          // Do NOT fallback on non-retryable errors (e.g. 400, 401, 403, 404)
          if (!isRetryable && i < geminiModelCandidates.length - 1) {
            const nonRetryErr = new Error(`Provider 'gemini' request failed: Gemini model '${geminiModel}' returned HTTP status ${response.status}: ${cleanErrText}`);
            nonRetryErr.isNonRetryable = true;
            throw nonRetryErr;
          }
        }
      } catch (err) {
        if (err.isNonRetryable || (err.message && err.message.startsWith("Provider 'gemini' request failed:"))) {
          throw err;
        }
        const cleanMessage = sanitizeError(err.message, [apiKey]);
        console.warn(`[AI Provider Error] Gemini model '${geminiModel}' request failed: ${cleanMessage}`);
        attemptErrors.push({
          model: geminiModel,
          status: null,
          message: cleanMessage
        });
      }

      const retryDelayMs = Number(process.env.GEMINI_RETRY_DELAY_MS ?? 0);
      if (i < geminiModelCandidates.length - 1 && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }

    if (attemptErrors.length === 1) {
      const single = attemptErrors[0];
      const statusLabel = single.status ? `HTTP status ${single.status}` : 'failed';
      throw new Error(`Provider 'gemini' request failed: Gemini model '${single.model}' returned ${statusLabel}: ${single.message}`);
    }

    const errorDetails = attemptErrors.map((att, idx) => {
      const prefix = idx === 0 ? 'Primary model' : 'Fallback model';
      const statusLabel = att.status ? `HTTP status ${att.status}` : 'failed';
      return `${prefix} '${att.model}' returned ${statusLabel}: ${att.message}`;
    }).join('; ');

    throw new Error(`Provider 'gemini' request failed: ${errorDetails}`);
  }

  // 3. Handle EXTERNAL_API mode: OpenRouter
  if (normProvider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Provider 'openrouter' is not configured: OPENROUTER_API_KEY is missing in backend environment.");
    }

    const openrouterModel = resolveModelForProvider('openrouter', model);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'LLM Red-Teaming System'
        },
        body: JSON.stringify({
          model: openrouterModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt }
          ],
          temperature
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          console.log(`[AI Provider Result] SUCCESS via OpenRouter (Model: '${openrouterModel}', Mode: EXTERNAL_API, isMock: false)`);
          return {
            text: reply,
            providerUsed: 'openrouter',
            modeUsed: 'EXTERNAL_API',
            isMock: false,
            modelUsed: openrouterModel
          };
        }
        throw new Error(`OpenRouter model '${openrouterModel}' returned empty choice content.`);
      }
      const rawErrText = await response.text();
      const cleanErrText = sanitizeError(rawErrText, [apiKey]).trim();
      throw new Error(`OpenRouter returned HTTP status ${response.status}: ${cleanErrText}`);
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        throw new Error(`Provider 'openrouter' request timed out after 25s for model '${openrouterModel}'.`);
      }
      const cleanMsg = sanitizeError(err.message, [apiKey]);
      throw new Error(`Provider 'openrouter' API request failed: ${cleanMsg}`);
    }
  }

  // 4. Handle EXTERNAL_API mode: Groq
  if (normProvider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Provider 'groq' is not configured: GROQ_API_KEY is missing in backend environment.");
    }

    const groqModel = resolveModelForProvider('groq', model);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt }
          ],
          temperature
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          console.log(`[AI Provider Result] SUCCESS via Groq (Model: '${groqModel}', Mode: EXTERNAL_API, isMock: false)`);
          return {
            text: reply,
            providerUsed: 'groq',
            modeUsed: 'EXTERNAL_API',
            isMock: false,
            modelUsed: groqModel
          };
        }
        throw new Error(`Groq model '${groqModel}' returned empty choice content.`);
      }
      const rawErrText = await response.text();
      const cleanErrText = sanitizeError(rawErrText, [apiKey]).trim();
      throw new Error(`Groq returned HTTP status ${response.status}: ${cleanErrText}`);
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        throw new Error(`Provider 'groq' request timed out after 25s for model '${groqModel}'.`);
      }
      const cleanMsg = sanitizeError(err.message, [apiKey]);
      throw new Error(`Provider 'groq' API request failed: ${cleanMsg}`);
    }
  }

  throw new Error(`Execution failed: No matching handler for provider '${provider}'.`);
}

module.exports = {
  generateCompletion
};
