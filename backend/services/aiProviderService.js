/**
 * AI Provider Abstraction Layer (Phase 2)
 * Supports Google Gemini, OpenRouter (free tier), Groq, Ollama (local), and Mock Fallback.
 * Guaranteed $0 cost operation with graceful fallback chain.
 */

async function generateCompletion({
  provider = 'gemini',
  mode = 'EXTERNAL_API',
  systemPrompt = '',
  userPrompt = '',
  model = '',
  temperature = 0.7
}) {
  // If explicitly set to MOCK mode, skip external API calls
  if (mode === 'MOCK' || provider === 'mock') {
    return {
      text: null,
      providerUsed: 'mock',
      modeUsed: 'MOCK',
      isMock: true
    };
  }

  // 1. Handle LOCAL mode (Ollama)
  if (mode === 'LOCAL' || provider === 'ollama') {
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const selectedModel = model || 'llama3.2';
      
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
          return {
            text: data.response,
            providerUsed: 'ollama',
            modeUsed: 'LOCAL',
            isMock: false
          };
        }
      }
    } catch (err) {
      console.warn('[AI Provider] Ollama call failed, attempting fallback:', err.message);
    }
  }

  // 2. Handle EXTERNAL_API mode: Gemini
  if (provider === 'gemini' || (!provider && process.env.GEMINI_API_KEY)) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const geminiModel = model || 'gemini-1.5-flash';
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
            return {
              text: reply,
              providerUsed: 'gemini',
              modeUsed: 'EXTERNAL_API',
              isMock: false
            };
          }
        } else {
          const errText = await response.text();
          console.warn('[AI Provider] Gemini API error response:', errText);
        }
      } catch (err) {
        console.warn('[AI Provider] Gemini API request failed:', err.message);
      }
    }
  }

  // 3. Handle EXTERNAL_API mode: OpenRouter (free models)
  if (provider === 'openrouter' || (!provider && process.env.OPENROUTER_API_KEY)) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      try {
        const openrouterModel = model || 'google/gemini-2.0-flash-lite-preview-02-05:free';
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
            return {
              text: reply,
              providerUsed: 'openrouter',
              modeUsed: 'EXTERNAL_API',
              isMock: false
            };
          }
        }
      } catch (err) {
        console.warn('[AI Provider] OpenRouter API request failed:', err.message);
      }
    }
  }

  // 4. Handle EXTERNAL_API mode: Groq
  if (provider === 'groq' || (!provider && process.env.GROQ_API_KEY)) {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      try {
        const groqModel = model || 'llama-3.3-70b-versatile';
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
            return {
              text: reply,
              providerUsed: 'groq',
              modeUsed: 'EXTERNAL_API',
              isMock: false
            };
          }
        }
      } catch (err) {
        console.warn('[AI Provider] Groq API request failed:', err.message);
      }
    }
  }

  // 5. Fallback to MOCK mode if external calls failed or keys were absent
  return {
    text: null,
    providerUsed: 'mock',
    modeUsed: 'MOCK',
    isMock: true
  };
}

module.exports = {
  generateCompletion
};
