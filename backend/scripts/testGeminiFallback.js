/**
 * Comprehensive Unit and Mock Regression Test Suite for Controlled Gemini Fallback
 *
 * Verifies:
 * 1. Primary success: primary model succeeds; secondary model is never called.
 * 2. Retryable failure: primary model returns HTTP 503; secondary model succeeds.
 * 3. Rate limiting: primary model returns HTTP 429; secondary model succeeds.
 * 4. Authentication failure: HTTP 401 and 403 do NOT trigger fallback (fails fast).
 * 5. Invalid request: HTTP 400 does NOT trigger fallback (fails fast).
 * 6. Both models fail: combined error preserves both model IDs and HTTP statuses without credential leaks.
 * 7. Other providers & explicit selection: provider isolation and explicit selections preserved.
 *
 * Safety: 100% in-memory / mocked fetch. Zero live AI calls, zero external quota, zero DB mutations.
 */

const {
  PROVIDER_MODELS,
  resolveModelForProvider,
  isSupportedProvider
} = require('../config/providerModels');
const { generateCompletion } = require('../services/aiProviderService');
const { callTargetModel } = require('../services/targetService');
const { callJudgeModel } = require('../services/judgeService');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`\u2705 PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`\u274c FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('GEMINI CONTROLLED FALLBACK & RESILIENCE REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const FAKE_API_KEY = 'AIzaSyFakeSecretGeminiKey987654321';

  try {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    // -------------------------------------------------------------------------
    // Case 1: Primary Success (gemini-3.5-flash-lite succeeds, secondary not called)
    // -------------------------------------------------------------------------
    console.log('--- Case 1: Primary Model Success ---');
    {
      const fetchCalls = [];
      global.fetch = async (url, options) => {
        fetchCalls.push({ url, options });
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Primary success response' }] } }]
          })
        };
      };

      const result = await generateCompletion({
        provider: 'gemini',
        mode: 'EXTERNAL_API',
        model: 'gemini-3.5-flash-lite',
        userPrompt: 'Test prompt'
      });

      assert(result.text === 'Primary success response', 'Returns response from primary model');
      assert(result.modelUsed === 'gemini-3.5-flash-lite', 'modelUsed is primary model gemini-3.5-flash-lite');
      assert(result.providerUsed === 'gemini', 'providerUsed is gemini');
      assert(result.isMock === false, 'isMock is false');
      assert(fetchCalls.length === 1, 'Only one HTTP request made (secondary candidate never called)');
      assert(fetchCalls[0].url.includes('/models/gemini-3.5-flash-lite:generateContent'), 'Request targeted gemini-3.5-flash-lite');
      assert(fetchCalls[0].options.headers['x-goog-api-key'] === FAKE_API_KEY, 'Authenticated via x-goog-api-key header');
      assert(!fetchCalls[0].url.includes('key='), 'API key is NOT exposed in request URL');
    }

    // -------------------------------------------------------------------------
    // Case 2: Retryable Failure (HTTP 503 on primary, secondary succeeds)
    // -------------------------------------------------------------------------
    console.log('\n--- Case 2: Retryable Failure (HTTP 503 Fallback) ---');
    {
      const fetchCalls = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls.push({ url, model, options });

        if (model === 'gemini-3.5-flash-lite') {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: async () => 'The model is overloaded. Please try again later.'
          };
        }

        if (model === 'gemini-3.5-flash') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: 'Fallback flash response' }] } }]
            })
          };
        }

        throw new Error(`Unexpected model: ${model}`);
      };

      const result = await generateCompletion({
        provider: 'gemini',
        mode: 'EXTERNAL_API',
        model: 'gemini-3.5-flash-lite',
        userPrompt: 'Test prompt'
      });

      assert(result.text === 'Fallback flash response', 'Returns response from secondary model');
      assert(result.modelUsed === 'gemini-3.5-flash', 'modelUsed reflects secondary fallback model gemini-3.5-flash');
      assert(result.providerUsed === 'gemini', 'providerUsed is gemini');
      assert(result.isMock === false, 'isMock is false');
      assert(fetchCalls.length === 2, 'Exactly two HTTP requests made (primary then secondary)');
      assert(fetchCalls[0].model === 'gemini-3.5-flash-lite', 'First call attempted primary gemini-3.5-flash-lite');
      assert(fetchCalls[1].model === 'gemini-3.5-flash', 'Second call attempted secondary gemini-3.5-flash');
    }

    // -------------------------------------------------------------------------
    // Case 3: Rate Limiting (HTTP 429 triggers fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- Case 3: Rate Limiting (HTTP 429 Fallback) ---');
    {
      const fetchCalls = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls.push({ url, model, options });

        if (model === 'gemini-3.5-flash-lite') {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: async () => 'RESOURCE_EXHAUSTED: Rate limit exceeded for flash-lite'
          };
        }

        if (model === 'gemini-3.5-flash') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: 'Rate-limit fallback response' }] } }]
            })
          };
        }

        throw new Error(`Unexpected model: ${model}`);
      };

      const result = await generateCompletion({
        provider: 'gemini',
        mode: 'EXTERNAL_API',
        model: 'gemini-3.5-flash-lite',
        userPrompt: 'Test prompt'
      });

      assert(result.text === 'Rate-limit fallback response', 'Returns response from secondary model after 429');
      assert(result.modelUsed === 'gemini-3.5-flash', 'modelUsed is gemini-3.5-flash');
      assert(fetchCalls.length === 2, 'Attempted fallback after HTTP 429');
      assert(fetchCalls[0].model === 'gemini-3.5-flash-lite', 'First request was primary model');
      assert(fetchCalls[1].model === 'gemini-3.5-flash', 'Second request was secondary model');
    }

    // -------------------------------------------------------------------------
    // Case 4: Authentication Failure (HTTP 401 & 403 do NOT trigger fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- Case 4: Authentication Failure (Fails Fast, No Fallback) ---');
    {
      // 4a: HTTP 401
      let fetchCalls401 = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls401.push({ url, model, options });

        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => `API key invalid: key=${FAKE_API_KEY}`
        };
      };

      let error401 = null;
      try {
        await generateCompletion({
          provider: 'gemini',
          mode: 'EXTERNAL_API',
          model: 'gemini-3.5-flash-lite',
          userPrompt: 'Test prompt'
        });
      } catch (err) {
        error401 = err;
      }

      assert(error401 !== null, 'Throws on HTTP 401 authentication failure');
      assert(fetchCalls401.length === 1, 'HTTP 401 fails fast: secondary model was NEVER called');
      assert(error401.message.includes('401'), 'Error contains HTTP 401 status');
      assert(error401.message.includes('gemini-3.5-flash-lite'), 'Error contains primary model ID');
      assert(!error401.message.includes(FAKE_API_KEY), 'API key is sanitized and not exposed in 401 error message');

      // 4b: HTTP 403
      let fetchCalls403 = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls403.push({ url, model, options });

        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'PERMISSION_DENIED: project does not have access'
        };
      };

      let error403 = null;
      try {
        await generateCompletion({
          provider: 'gemini',
          mode: 'EXTERNAL_API',
          model: 'gemini-3.5-flash-lite',
          userPrompt: 'Test prompt'
        });
      } catch (err) {
        error403 = err;
      }

      assert(error403 !== null, 'Throws on HTTP 403 permission failure');
      assert(fetchCalls403.length === 1, 'HTTP 403 fails fast: secondary model was NEVER called');
      assert(error403.message.includes('403'), 'Error contains HTTP 403 status');
      assert(error403.message.includes('gemini-3.5-flash-lite'), 'Error contains primary model ID');
    }

    // -------------------------------------------------------------------------
    // Case 5: Invalid Request (HTTP 400 does NOT trigger fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- Case 5: Invalid Request (HTTP 400 Fails Fast) ---');
    {
      const fetchCalls = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls.push({ url, model, options });

        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => 'INVALID_ARGUMENT: contents structure is invalid'
        };
      };

      let error400 = null;
      try {
        await generateCompletion({
          provider: 'gemini',
          mode: 'EXTERNAL_API',
          model: 'gemini-3.5-flash-lite',
          userPrompt: 'Test prompt'
        });
      } catch (err) {
        error400 = err;
      }

      assert(error400 !== null, 'Throws on HTTP 400 bad request');
      assert(fetchCalls.length === 1, 'HTTP 400 fails fast: secondary model was NEVER called');
      assert(error400.message.includes('400'), 'Error contains HTTP 400 status');
      assert(error400.message.includes('gemini-3.5-flash-lite'), 'Error contains primary model ID');
    }

    // -------------------------------------------------------------------------
    // Case 6: Both Models Fail (Meaningful combined error with model IDs & statuses)
    // -------------------------------------------------------------------------
    console.log('\n--- Case 6: Both Models Fail ---');
    {
      const fetchCalls = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        fetchCalls.push({ url, model, options });

        if (model === 'gemini-3.5-flash-lite') {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: async () => `flash-lite unavailable (bearer key=${FAKE_API_KEY})`
          };
        }

        if (model === 'gemini-3.5-flash') {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: async () => 'flash also overloaded'
          };
        }

        throw new Error(`Unexpected model: ${model}`);
      };

      let bothFailedError = null;
      try {
        await generateCompletion({
          provider: 'gemini',
          mode: 'EXTERNAL_API',
          model: 'gemini-3.5-flash-lite',
          userPrompt: 'Test prompt'
        });
      } catch (err) {
        bothFailedError = err;
      }

      assert(bothFailedError !== null, 'Throws when both candidate models fail');
      assert(fetchCalls.length === 2, 'Both primary and secondary candidates were attempted');
      assert(bothFailedError.message.includes('gemini-3.5-flash-lite'), 'Final error contains primary model ID');
      assert(bothFailedError.message.includes('gemini-3.5-flash'), 'Final error contains fallback model ID');
      assert(bothFailedError.message.includes('503'), 'Final error contains HTTP status code');
      assert(!bothFailedError.message.includes(FAKE_API_KEY), 'Credentials sanitized: FAKE_API_KEY is not exposed');
    }

    // -------------------------------------------------------------------------
    // Case 7: Other Providers & Explicit Model Selection
    // -------------------------------------------------------------------------
    console.log('\n--- Case 7: Other Providers & Explicit Model Selection ---');
    {
      // 7a: Registered models registry check
      const geminiConfig = PROVIDER_MODELS.gemini;
      assert(geminiConfig.models.some(m => m.id === 'gemini-3.5-flash'), 'gemini-3.5-flash is registered in PROVIDER_MODELS.gemini');
      assert(geminiConfig.defaultModel === 'gemini-3.5-flash-lite', 'Default model remains gemini-3.5-flash-lite');

      // 7b: Explicit selection of gemini-3.5-flash directly does not create duplicate fallback
      const flashFetchCalls = [];
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        flashFetchCalls.push({ url, model });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Explicit flash response' }] } }]
          })
        };
      };

      const explicitFlashRes = await generateCompletion({
        provider: 'gemini',
        mode: 'EXTERNAL_API',
        model: 'gemini-3.5-flash',
        userPrompt: 'Test explicit selection'
      });

      assert(explicitFlashRes.modelUsed === 'gemini-3.5-flash', 'Explicitly selected model gemini-3.5-flash is preserved');
      assert(flashFetchCalls.length === 1, 'Only one request made when explicitly selecting gemini-3.5-flash');
      assert(flashFetchCalls[0].model === 'gemini-3.5-flash', 'Direct request targeted gemini-3.5-flash');

      // 7c: Mock provider behavior remains unchanged
      const mockRes = await generateCompletion({
        provider: 'mock',
        mode: 'MOCK',
        model: 'gpt-4',
        userPrompt: 'Mock test'
      });
      assert(mockRes.providerUsed === 'mock', 'Mock provider returns providerUsed === mock');
      assert(mockRes.isMock === true, 'Mock provider returns isMock === true');

      // 7d: Target and Judge service fallback integration
      global.fetch = async (url, options) => {
        const match = url.match(/\/models\/([^:]+):generateContent/);
        const model = match ? match[1] : 'unknown';
        if (model === 'gemini-3.5-flash-lite') {
          return { ok: false, status: 503, text: async () => 'Overloaded' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '{"score": 25, "flags": ["none"], "reasoning": "Safe response"}' }] } }]
          })
        };
      };

      const targetRes = await callTargetModel('gemini-3.5-flash-lite', 'Adversarial prompt', {
        provider: 'gemini',
        mode: 'EXTERNAL_API'
      });
      assert(targetRes.modelUsed === 'gemini-3.5-flash', 'callTargetModel successfully falls back to gemini-3.5-flash');

      const judgeRes = await callJudgeModel('Prompt', 'Response', {
        provider: 'gemini',
        mode: 'EXTERNAL_API',
        model: 'gemini-3.5-flash-lite'
      });
      assert(judgeRes.modelUsed === 'gemini-3.5-flash', 'callJudgeModel successfully falls back to gemini-3.5-flash');
      assert(judgeRes.score === 25, 'callJudgeModel parses fallback evaluation score');
    }

  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  console.log('\n===============================================================');
  console.log(`GEMINI FALLBACK TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
