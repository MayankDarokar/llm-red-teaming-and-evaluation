/**
 * AI Provider Abstraction Layer (Phase 2)
 * Supports Google Gemini, OpenRouter (free tier), Groq, Ollama (local), and Mock Fallback.
 * Guaranteed $0 cost operation with graceful fallback chain & automatic 503 model failover.
 */

const { resolveModelForProvider } = require('../config/providerModels');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateCompletion({
  provider = 'gemini',
  mode = 'EXTERNAL_API',
  systemPrompt = '',
  userPrompt = '',
  model = '',
  temperature = 0.7
}) {
  console.log(`[AI Provider Call] Requesting provider: '${provider}', mode: '${mode}', model: '${model || '(default)'}'`);

  // If explicitly set to MOCK mode, skip external API calls
  if (mode === 'MOCK' || provider === 'mock') {
    const resolvedModel = resolveModelForProvider('mock', model);
    console.log(`[AI Provider Result] Executing MOCK mode for model '${resolvedModel}'`);
    return {
      text: null,
      providerUsed: 'mock',
      modeUsed: 'MOCK',
      isMock: true,
      modelUsed: resolvedModel
    };
  }

  // 1. Handle LOCAL mode (Ollama)
  if (mode === 'LOCAL' || provider === 'ollama') {
    const selectedModel = resolveModelForProvider('ollama', model);
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: { temperature }
        })
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
    } catch (err) {
      console.warn('[AI Provider] Ollama call failed, attempting fallback:', err.message);
    }
  }

  // 2. Handle EXTERNAL_API mode: Gemini (with multi-model candidate failover & backoff delay for 503 capacity limits)
  if (provider === 'gemini' || (!provider && process.env.GEMINI_API_KEY)) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const primaryModel = resolveModelForProvider('gemini', model);
      const geminiModelCandidates = [...new Set([primaryModel, 'gemini-3.5-flash-lite'])];

      for (let i = 0; i < geminiModelCandidates.length; i++) {
        const geminiModel = geminiModelCandidates[i];
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

          const contents = [];
          if (systemPrompt) {
            contents.push({ role: 'user', parts: [{ text: `[System Instructions]\n${systemPrompt}` }] });
            contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
          }
          contents.push({ role: 'user', parts: [{ text: userPrompt }] });

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: { temperature }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
              console.log(`[AI Provider Result] SUCCESS via Google Gemini (Model: '${geminiModel}', Mode: EXTERNAL_API, isMock: false)`);
              return {
                text: reply,
                providerUsed: 'gemini',
                modeUsed: 'EXTERNAL_API',
                isMock: false,
                modelUsed: geminiModel
              };
            }
          } else {
            const errText = await response.text();
            console.warn(`[AI Provider Error] Gemini model '${geminiModel}' returned HTTP status ${response.status}:`, errText);
            if (i < geminiModelCandidates.length - 1) {
              await sleep(1200);
            }
          }
        } catch (err) {
          console.warn(`[AI Provider Error] Gemini model '${geminiModel}' request failed:`, err.message);
          if (i < geminiModelCandidates.length - 1) {
            await sleep(1200);
          }
        }
      }
    } else {
      console.warn('[AI Provider Error] GEMINI_API_KEY is not defined in backend/.env!');
    }
  }

  // 3. Handle EXTERNAL_API mode: OpenRouter (free models)
  if (provider === 'openrouter' || (!provider && process.env.OPENROUTER_API_KEY)) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
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
          })
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
        }
      } catch (err) {
        console.warn('[AI Provider Error] OpenRouter API request failed:', err.message);
      }
    }
  }

  // 4. Handle EXTERNAL_API mode: Groq
  if (provider === 'groq' || (!provider && process.env.GROQ_API_KEY)) {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
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
          })
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
        }
      } catch (err) {
        console.warn('[AI Provider Error] Groq API request failed:', err.message);
      }
    }
  }

  // 5. Fallback to MOCK mode if external calls failed or keys were absent
  console.warn(`[AI Provider Fallback] Could not execute call via provider '${provider}'. Falling back to MOCK mode.`);
  return {
    text: null,
    providerUsed: 'mock',
    modeUsed: 'MOCK',
    isMock: true,
    modelUsed: model || 'gpt-4'
  };
}

module.exports = {
  generateCompletion
};
